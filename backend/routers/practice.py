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

from services.ai_service import chat, FAST_MODEL
from services.supabase_service import log_attempt, get_supabase

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
    """Remove ```json ... ``` fences that LLMs sometimes wrap around JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


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
                "Return ONLY valid JSON — no markdown, no explanation. "
                "The JSON must be an object with the key 'questions' containing an array of objects "
                "with keys: id (string), question (str), "
                "options (array of EXACTLY 4 strings), "
                "answer (str, MUST perfectly match one of the exact strings in the options array), "
                "explanation (str), concept_tested (str)."
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
        result_text: str = chat(messages, model=FAST_MODEL)
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
    """Check a user's answer and log the attempt.

    Compares ``user_answer`` to ``correct_answer`` (case-insensitive,
    stripped), assigns a score of 5 (correct) or 0 (wrong), and
    persists the attempt via Supabase.
    """
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

    return {
        "correct": is_correct,
        "score": score,
        "correct_answer": req.correct_answer,
    }


@router.get("/weak-areas/{user_id}")
async def get_weak_areas(user_id: str) -> dict:
    """Return the user's weakest topics sorted by average score.

    Joins the ``attempts`` and ``cards`` tables, groups by
    topic + subject, and returns the bottom-10 topics.
    """
    try:
        # Fetch all attempts for this user with card details
        attempts_resp = (
            get_supabase()
            .table("attempts")
            .select("score, card_id, cards(topic, subject)")
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
        card_info = attempt.get("cards", {}) or {}
        topic = card_info.get("topic", "unknown")
        subject = card_info.get("subject", "unknown")
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
