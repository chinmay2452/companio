"""
Planner Router — AI-powered daily study plan generation.

Uses the Groq LLM to create personalised study schedules
based on weak topics, due cards, and upcoming exam dates.
"""

from __future__ import annotations

import json
import re
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_service import chat, FAST_MODEL
from services.supabase_service import (
    get_weak_topics,
    fetch_due_cards,
    save_daily_plan,
    get_supabase,
)

router = APIRouter()


# ── Request Models ───────────────────────────────────────────────────

class PlanRequest(BaseModel):
    """Payload for requesting a daily study plan."""
    user_id: str
    exam_type: str          # e.g. "JEE", "NEET", "UPSC"
    exam_date: str          # ISO date of the exam
    available_hours: float = Field(..., gt=0)


# ── Helpers ──────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` fences that LLMs sometimes wrap around JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_plan(req: PlanRequest) -> dict:
    """Generate a personalised daily study plan via Groq AI.

    Gathers the user's weak topics and due SRS cards, then asks the
    FAST_MODEL to produce a structured JSON study plan.
    """
    try:
        weak_topics = get_weak_topics(req.user_id, limit=5)
        due_cards = fetch_due_cards(req.user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user data: {e}")

    # Build context strings
    weak_list = ", ".join(t.get("topic", "") for t in weak_topics[:5]) if weak_topics else "general revision"
    due_summary = ", ".join(
        c.get("topic", "untitled") for c in due_cards[:10]
    ) if due_cards else "no cards due"

    today_iso = date.today().isoformat()

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an expert {req.exam_type} study planner. "
                "Return ONLY valid JSON — no markdown, no explanation. "
                "The JSON must have these keys: "
                "date (string), total_hours (number), "
                "sessions (array of objects with keys: time_slot, subject, topic, "
                "activity, duration_min, priority), "
                "focus_message (string with a motivational tip)."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create a study plan for {req.available_hours} hours today ({today_iso}). "
                f"Exam: {req.exam_type} on {req.exam_date}. "
                f"Weak topics to prioritise: {weak_list}. "
                f"SRS cards due for review: {due_summary}. "
                "Allocate time blocks and return the JSON."
            ),
        },
    ]

    try:
        plan_text: str = chat(messages, model=FAST_MODEL)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI planner failed: {e}")

    # Parse the JSON response
    try:
        plan_json = json.loads(_strip_markdown_fences(plan_text))
    except json.JSONDecodeError:
        # Return raw text if JSON parsing fails
        plan_json = {"raw": plan_text}

    # Persist the plan
    try:
        save_daily_plan(req.user_id, today_iso, plan_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save plan: {e}")

    return {"plan": plan_json}


@router.get("/{user_id}/today")
async def get_today_plan(user_id: str) -> dict:
    """Retrieve the user's study plan for today."""
    today_iso = date.today().isoformat()

    try:
        response = (
            get_supabase()
            .table("daily_plans")
            .select("plan")
            .eq("user_id", user_id)
            .eq("plan_date", today_iso)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch plan: {e}")

    if response.data:
        return {"plan": response.data[0].get("plan")}
    return {"plan": None, "message": "No plan for today yet. Generate one!"}
