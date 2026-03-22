"""
Planner Router — AI-powered daily study plan generation.

Uses the Groq LLM to create personalised study schedules
based on weak topics and upcoming exam dates.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import chat, FAST_MODEL
from services.supabase_service import get_weak_topics, save_daily_plan

router = APIRouter()


class PlanRequest(BaseModel):
    """Payload for requesting a daily study plan."""

    user_id: str
    exam: str  # e.g. "JEE", "NEET", "UPSC"
    available_hours: float
    plan_date: str  # ISO date


@router.post("/generate")
async def generate_plan(req: PlanRequest) -> dict:
    """Generate a personalised daily study plan via AI."""
    weak = get_weak_topics(req.user_id, limit=5)
    weak_list = ", ".join(t["topic"] for t in weak) if weak else "general revision"

    messages = [
        {
            "role": "system",
            "content": (
                f"You are a {req.exam} study planner. "
                "Return a JSON study plan with time blocks."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create a study plan for {req.available_hours} hours on {req.plan_date}. "
                f"Focus on weak topics: {weak_list}. "
                "Return JSON with keys: blocks (list of {{topic, duration_min, activity}})."
            ),
        },
    ]

    plan_text: str = chat(messages, model=FAST_MODEL)
    save_daily_plan(req.user_id, req.plan_date, {"raw": plan_text})
    return {"plan": plan_text}
