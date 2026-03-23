"""
Practice Router — adaptive MCQ generation and answer submission.

Generates PYQ-style multiple-choice questions, handles answer
submission with scoring, and exposes weak-area analytics.
"""

from __future__ import annotations

import json
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_service import chat, FAST_MODEL, extract_concept
from services.supabase_service import log_attempt, get_supabase, upsert_weak_topic

router = APIRouter()


# ── Request Models ───────────────────────────────────────────────────

class MCQRequest(BaseModel):
    """Payload for requesting practice MCQs."""
    topic: str
    subject: str
    difficulty: str = "medium"   # easy | medium | hard
    count: int = Field(5, ge=1, le=20)
    exam_type: str = "JEE"


class SubmitRequest(BaseModel):
    """Payload for submitting an answer to a practice question."""
    user_id: str
    card_id: str
    question: str
    user_answer: str
    correct_answer: str
    time_seconds: int = 0
    subject: str = "Unknown"
    topic: str = "Unknown"


# ── Helpers ──────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Extract JSON from LLM output, handling markdown fences and conversational filler."""
    text = text.strip()
    start_idx = -1
    end_idx = -1
    
    for i, char in enumerate(text):
        if char in ('{', '['):
            start_idx = i
            break
            
    for i in range(len(text)-1, -1, -1):
        if text[i] in ('}', ']'):
            end_idx = i
            break
            
    if start_idx != -1 and end_idx != -1 and start_idx <= end_idx:
        return text[start_idx:end_idx+1]
        
    return text


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_mcqs(req: MCQRequest) -> dict:
    if not req.subject or not req.topic:
        raise HTTPException(status_code=400, detail="Subject and topic required")

    TOPIC_SCOPE = {
        "F block": "Lanthanides and Actinides only",
        "f block": "Lanthanides and Actinides only",
        "F-block": "Lanthanides and Actinides only",
        "D block": "Transition metals only",
        "d block": "Transition metals only",
        "D-block": "Transition metals only",
    }
    scope = TOPIC_SCOPE.get(req.topic, req.topic)

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a {req.exam_type} Previous Year Question paper setter. "
                "Generate realistic, exam-quality MCQs.\n"
                "STRICT RULES:\n"
                "- Only generate from the given topic.\n"
                "- Do NOT include related chapters.\n"
                "- Do NOT mix with other topics.\n"
                "- Example: If topic is 'F block', do NOT include D block.\n"
                "- Use NCERT level.\n"
                "The JSON must be an object with the key 'questions' containing an array of objects "
                "with keys: id (string), question (str), "
                "options (array of EXACTLY 4 distinct strings. EXACTLY ONE option must be completely correct, and the other THREE options MUST be definitively incorrect), "
                "answer (str, MUST perfectly match the text of the single correct option), "
                "explanation (str, provide a detailed step-by-step solution proving why the answer is correct), "
                "concept_tested (str, specify the specific micro-topic or formula tested in this question)."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate {req.count} {req.difficulty}-level PYQ-style MCQs.\n"
                f"Subject: {req.subject}\n"
                f"Topic: {req.topic}\n"
                f"Topic scope: {scope}"
            ),
        },
    ]

    try:
        result_text: str = chat(messages, model=FAST_MODEL, json_mode=True)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MCQ generation failed: {e}")

    try:
        parsed = json.loads(_strip_markdown_fences(result_text))
        questions = parsed.get("questions", parsed) if isinstance(parsed, dict) else parsed
    except json.JSONDecodeError:
        # Fallback: return raw text so the frontend can handle it
        questions = []

    return {"questions": questions}


@router.post("/submit")
async def submit_answer(req: SubmitRequest) -> dict:
    """Check a user's answer, log the attempt, and auto-generate a flashcard on wrong answers.

    Pipeline on incorrect answer:
    1. Log the attempt
    2. AI extracts the core concept + formula
    3. Insert a flashcard into the cards table (due today)
    4. Update weak_topics analytics
    5. Return flashcard info for frontend notification
    """
    from datetime import date

    is_correct = req.user_answer.strip().upper() == req.correct_answer.strip().upper()
    score = 5 if is_correct else 0

    try:
        log_attempt(
            user_id=req.user_id,
            card_id=None,
            subject=req.subject,
            topic=req.topic,
            correct=is_correct,
            score=score,
            time_seconds=req.time_seconds,
            source="practice"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log attempt: {e}")

    result = {
        "correct": is_correct,
        "score": score,
        "correct_answer": req.correct_answer,
    }

    # ── Auto-flashcard generation on wrong answers ───────────────
    if not is_correct:
        try:
            # 1. AI extracts concept + generates flashcard content
            concept_data = extract_concept(
                question=req.question,
                correct_answer=req.correct_answer,
                subject=req.subject,
                topic=req.topic,
            )

            # 2. Insert flashcard into cards table
            today_iso = date.today().isoformat()
            card_response = (
                get_supabase()
                .table("cards")
                .insert({
                    "user_id": req.user_id,
                    "subject": req.subject,
                    "topic": req.topic,
                    "front": concept_data.get("front", f"Key concept in {req.topic}?"),
                    "back": concept_data.get("back", req.correct_answer),
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "repetitions": 0,
                    "due_date": today_iso,
                })
                .execute()
            )

            # 3. Update weak_topics analytics
            # Fetch all attempts for this user+subject+topic to recalculate accuracy
            try:
                attempts_res = (
                    get_supabase()
                    .table("attempts")
                    .select("correct, time_seconds")
                    .eq("user_id", req.user_id)
                    .eq("subject", req.subject)
                    .eq("topic", req.topic)
                    .execute()
                )
                attempts = attempts_res.data or []
                total = len(attempts)
                correct_count = sum(1 for a in attempts if a.get("correct"))
                accuracy = correct_count / total if total > 0 else 0.0
                avg_time = sum(a.get("time_seconds", 0) for a in attempts) / total if total > 0 else 0.0

                upsert_weak_topic(
                    user_id=req.user_id,
                    subject=req.subject,
                    topic=req.topic,
                    accuracy=round(accuracy, 3),
                    avg_time_sec=round(avg_time, 1),
                    attempts_count=total,
                )
            except Exception as wt_err:
                print(f"Warning: weak_topics upsert failed: {wt_err}")

            # 4. Add flashcard info to response
            new_card = card_response.data[0] if card_response.data else {}
            result["flashcard_generated"] = {
                "card_id": new_card.get("id", ""),
                "concept": concept_data.get("concept", req.topic),
                "formula": concept_data.get("formula", ""),
                "front": concept_data.get("front", ""),
                "back": concept_data.get("back", ""),
            }
        except Exception as fc_err:
            print(f"Warning: auto-flashcard generation failed: {fc_err}")
            # Non-fatal — the answer is still logged even if flashcard fails

    return result


@router.get("/weak-areas/{user_id}")
async def get_weak_areas(user_id: str) -> dict:
    """Return the user's weakest topics sorted by average score.

    Groups attempts by topic + subject and returns the bottom-10 topics.
    """
    try:
        # Fetch all attempts for this user with their subject and topic
        attempts_resp = (
            get_supabase()
            .table("attempts")
            .select("score, subject, topic, card_id, cards(topic, subject)")
            .eq("user_id", user_id)
            .execute()
        )
        attempts = attempts_resp.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch attempts: {e}")

    if not attempts:
        return {"weak_areas": []}

    # Aggregate by topic + subject
    topic_stats: dict[str, dict] = {}
    for attempt in attempts:
        card_info = attempt.get("cards") or {}
        # Prioritize the topic/subject logged directly on the attempt, fallback to card
        topic = str(attempt.get("topic") or card_info.get("topic") or "unknown").strip()
        subject = str(attempt.get("subject") or card_info.get("subject") or "unknown").strip()
        
        # Skip malformed data
        if not topic or topic.lower() in ("unknown", "uncategorized", "") or subject.lower() in ("unknown", "uncategorized", ""):
            continue
            
        key = f"{topic}||{subject}"

        if key not in topic_stats:
            topic_stats[key] = {
                "topic": topic,
                "subject": subject,
                "total_score": 0,
                "attempts": 0,
            }
        topic_stats[key]["total_score"] += attempt.get("score", 0)
        topic_stats[key]["attempts"] += 1

    # Calculate averages and sort ascending
    weak_areas = []
    for stats in topic_stats.values():
        avg = round(stats["total_score"] / stats["attempts"], 2) if stats["attempts"] else 0
        weak_areas.append({
            "topic": stats["topic"],
            "subject": stats["subject"],
            "avg_score": avg,
            "attempts": stats["attempts"],
        })

    weak_areas.sort(key=lambda x: x["avg_score"])

    return {"weak_areas": weak_areas[:10]}
