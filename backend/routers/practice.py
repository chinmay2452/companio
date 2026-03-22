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
    """Generate PYQ-style MCQs via the Groq FAST_MODEL.

    Returns a structured JSON object with a ``questions`` array, each
    containing ``id``, ``question``, ``options``, ``correct``,
    ``explanation``, and ``concept_tested``.
    """
    messages = [
        {
            "role": "system",
            "content": (
                f"You are a {req.exam_type} Previous Year Question paper setter. "
                "Generate realistic, exam-quality MCQs. "
                "Return ONLY valid JSON — no markdown, no explanation. "
                "The JSON must have key 'questions' containing an array of objects "
                "with keys: id (int), question (str), "
                "options (object with keys A, B, C, D), "
                "correct (one of A/B/C/D), explanation (str), "
                "concept_tested (str)."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate {req.count} {req.difficulty}-level PYQ-style MCQs on "
                f"'{req.topic}' ({req.subject}) for {req.exam_type} exam."
            ),
        },
    ]

    try:
        result_text: str = chat(messages, model=FAST_MODEL)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MCQ generation failed: {e}")

    try:
        questions = json.loads(_strip_markdown_fences(result_text))
    except json.JSONDecodeError:
        # Fallback: return raw text so the frontend can handle it
        questions = {"raw": result_text}

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
        log_attempt(req.user_id, req.card_id, score, req.time_seconds)
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
