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
from typing import Optional

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
    exam_type: str = "JEE"
    exam_date: Optional[str] = None
    available_hours: float = 6.0
    subjects: Optional[list[str]] = None
    topics_focus: Optional[str] = None


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
    FAST_MODEL to produce a structured JSON study plan that the
    frontend can render directly.
    """
    # Gather user context from Supabase
    weak_topics = []
    due_cards = []
    try:
        weak_topics = get_weak_topics(req.user_id, limit=5)
    except Exception:
        pass
    try:
        due_cards = fetch_due_cards(req.user_id)
    except Exception:
        pass

    # Build context strings
    weak_list = ", ".join(
        f"{t.get('topic', '')} ({t.get('subject', '')} — {t.get('accuracy', '?')}% accuracy)"
        for t in weak_topics[:5]
    ) if weak_topics else "no weak topics detected yet"

    due_summary = ", ".join(
        f"{c.get('topic', 'untitled')} ({c.get('subject', '')})"
        for c in due_cards[:10]
    ) if due_cards else "no cards due"

    today_iso = date.today().isoformat()
    exam_date_str = req.exam_date or "upcoming"

    subjects_hint = ""
    if req.subjects:
        subjects_hint = f"IMPORTANT: You MUST ONLY include these subjects: {', '.join(req.subjects)}. Do NOT include any other subjects (e.g. no Biology for JEE). "

    topic_focus_hint = ""
    if req.topics_focus:
        topic_focus_hint = f"The student explicitly requested to focus heavily on these topics today: {req.topics_focus}. Make sure to prioritize them. "

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an expert {req.exam_type} study planner for Indian competitive exams. "
                "Create a realistic, actionable daily study plan. "
                "Return ONLY a valid JSON array — no markdown, no explanation, no wrapping object. "
                "Each element in the array must be an object with EXACTLY these keys:\n"
                '  "time" (string like "08:00 AM"),\n'
                '  "type" (one of "NEW", "REVISE", "PRACTICE", "BREAK"),\n'
                '  "topic" (string — subject + specific topic),\n'
                '  "detail" (string — brief reason, duration, priority),\n'
                '  "subject" (string — Physics/Chemistry/Maths/Biology),\n'
                '  "duration_min" (integer — minutes for this block),\n'
                '  "priority" (one of "high", "medium", "low")\n'
                "Rules:\n"
                "- Weak topics must be marked as HIGH priority\n"
                "- Due SRS cards should get REVISE blocks\n"
                "- Include 1-2 short breaks\n"
                "- Start from morning, schedule realistically through the day\n"
                "- Provide specific topic names, not generic ones\n"
                "- Return ONLY the JSON array, nothing else"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create a study plan for {req.available_hours} hours today ({today_iso}). "
                f"Exam: {req.exam_type} on {exam_date_str}. "
                f"{subjects_hint} "
                f"{topic_focus_hint} "
                f"Weak topics (prioritise these along with requested topics): {weak_list}. "
                f"SRS cards due for review: {due_summary}. "
                "Return ONLY the JSON array."
            ),
        },
    ]

    try:
        plan_text: str = chat(messages, model=FAST_MODEL, max_tokens=2048)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI planner failed: {e}")

    # Parse the JSON response robustly
    plan_json = []
    try:
        # First try normal JSON parsing after stripping basic markdown
        stripped = _strip_markdown_fences(plan_text)
        plan_json = json.loads(stripped)
    except json.JSONDecodeError:
        # Fallback: extract the largest array from the text using regex
        try:
            match = re.search(r"\[.*\]", plan_text, re.DOTALL)
            if match:
                plan_json = json.loads(match.group(0))
            else:
                # Try finding a single object
                match_obj = re.search(r"\{.*\}", plan_text, re.DOTALL)
                if match_obj:
                    plan_json = json.loads(match_obj.group(0))
                else:
                    raise ValueError("No JSON payload found")
        except Exception:
            # Last resort fallback
            plan_json = [{
                "time": "08:00 AM",
                "type": "NEW",
                "topic": "AI-generated plan (raw)",
                "detail": plan_text[:200] + "...",
                "subject": "General",
                "duration_min": 60,
                "priority": "medium"
            }]

    # Ensure it's a list
    if isinstance(plan_json, dict):
        for key in ["sessions", "plan", "schedule", "blocks", "data"]:
            if key in plan_json and isinstance(plan_json[key], list):
                plan_json = plan_json[key]
                break
        else:
            plan_json = [plan_json]

    # Calculate total minutes
    total_minutes = 0
    for session in plan_json:
        if isinstance(session, dict):
            total_minutes += session.get("duration_min", 30)

    # Persist the plan
    try:
        save_daily_plan(req.user_id, today_iso, plan_json)
    except Exception as e:
        # Don't fail the whole request if save fails
        print(f"Warning: Failed to save plan: {e}")

    return {"plan": plan_json, "total_minutes": total_minutes}


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
        row = response.data[0]
        return {
            "plan": row.get("plan"),
        }
    return {"plan": None, "message": "No plan for today yet. Generate one!"}
