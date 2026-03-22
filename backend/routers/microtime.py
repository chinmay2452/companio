"""
Microtime Router — micro-learning optimisation.

Generates bite-sized study tasks that fit into short free windows
(e.g. 5-15 minutes between classes).
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import chat, FAST_MODEL
from services.supabase_service import get_weak_topics

router = APIRouter()


class MicrotimeRequest(BaseModel):
    """Payload for a micro-study session request."""

    user_id: str
    available_minutes: int  # e.g. 5, 10, 15
    exam: str


@router.post("/suggest")
async def suggest_micro_task(req: MicrotimeRequest) -> dict:
    """Suggest a quick study activity that fits the available time."""
    weak = get_weak_topics(req.user_id, limit=3)
    topics = ", ".join(t["topic"] for t in weak) if weak else "general revision"

    messages = [
        {
            "role": "system",
            "content": (
                "You are a micro-learning optimizer. Suggest a single, "
                "focused study task that can be completed in the given time."
            ),
        },
        {
            "role": "user",
            "content": (
                f"I have {req.available_minutes} minutes. "
                f"Exam: {req.exam}. Weak topics: {topics}. "
                "Suggest one focused task with: topic, activity type "
                "(flashcards / quick-read / 3-MCQ quiz), and key points to cover."
            ),
        },
    ]

    suggestion: str = chat(messages, model=FAST_MODEL)
    return {"suggestion": suggestion, "minutes": req.available_minutes}
