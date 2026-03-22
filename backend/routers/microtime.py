"""
Microtime Router — micro-learning sessions for short time windows.

Generates bite-sized study sessions with flashcards, MCQs, and formulas
that fit into 2, 5, or 10-minute free windows between classes.
Tracks daily streaks to encourage consistent micro-study habits.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_service import chat, FAST_MODEL
from services.supabase_service import fetch_due_cards, get_supabase

router = APIRouter()


# ── Content rules by available minutes ───────────────────────────────

CONTENT_RULES: dict[int, dict[str, int]] = {
    2:  {"n_cards": 1, "n_mcq": 0, "n_formula": 1},
    5:  {"n_cards": 2, "n_mcq": 1, "n_formula": 1},
    10: {"n_cards": 3, "n_mcq": 2, "n_formula": 1},
}

# Fallback: closest bucket for arbitrary minute values
def _get_content_rule(minutes: int) -> dict[str, int]:
    """Return content counts for the given minute bucket."""
    if minutes <= 2:
        return CONTENT_RULES[2]
    elif minutes <= 5:
        return CONTENT_RULES[5]
    else:
        return CONTENT_RULES[10]


# ── Request Models ───────────────────────────────────────────────────

class SessionRequest(BaseModel):
    """Payload for starting a micro-study session."""
    user_id: str
    minutes: int = Field(..., ge=1, le=30)
    subject: str = "any"


class LogRequest(BaseModel):
    """Payload for logging a completed micro-session."""
    user_id: str
    subject: str
    minutes: int
    items_completed: int


# ── Helpers ──────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` fences that LLMs sometimes wrap around JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _generate_mcq(subject: str, topic: str) -> dict | None:
    """Ask Groq FAST_MODEL for 1 MCQ. Returns parsed JSON or None."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a JEE/NEET question generator. "
                "Return ONLY JSON, no markdown, no explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate 1 JEE MCQ on {subject} - {topic}. "
                "Return ONLY JSON: "
                '{\"question\": \"...\", \"options\": {\"A\": \"...\", \"B\": \"...\", '
                '\"C\": \"...\", \"D\": \"...\"}, \"correct\": \"...\", \"explanation\": \"...\"}'
            ),
        },
    ]
    try:
        result = chat(messages, model=FAST_MODEL, max_tokens=512)
        return json.loads(_strip_markdown_fences(result))
    except Exception:
        return None


def _generate_formula(subject: str, topic: str) -> dict | None:
    """Ask Groq FAST_MODEL for 1 key formula. Returns parsed JSON or None."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a JEE/NEET formula expert. "
                "Return ONLY JSON, no markdown, no explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Give 1 key formula for {subject} - {topic}. "
                "Return ONLY JSON: "
                '{\"title\": \"...\", \"formula\": \"...\", \"meaning\": \"...\", \"example\": \"...\"}'
            ),
        },
    ]
    try:
        result = chat(messages, model=FAST_MODEL, max_tokens=512)
        return json.loads(_strip_markdown_fences(result))
    except Exception:
        return None


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/session")
async def create_session(req: SessionRequest) -> dict:
    """Generate a micro-study session with flashcards, MCQs, and formulas.

    Content is scaled to fit the available minutes:
    - 2 min  → 1 flashcard + 0 MCQ + 1 formula
    - 5 min  → 2 flashcards + 1 MCQ + 1 formula
    - 10 min → 3 flashcards + 2 MCQs + 1 formula
    """
    rule = _get_content_rule(req.minutes)

    # Fetch due cards from Supabase
    try:
        due_cards = fetch_due_cards(req.user_id)
    except Exception:
        due_cards = []

    # Filter by subject if specified
    if req.subject != "any" and due_cards:
        filtered = [c for c in due_cards if c.get("subject", "").lower() == req.subject.lower()]
        if filtered:
            due_cards = filtered

    # If no due cards, fetch any random cards for the user
    if not due_cards:
        try:
            resp = (
                get_supabase()
                .table("cards")
                .select("*")
                .eq("user_id", req.user_id)
                .limit(rule["n_cards"])
                .execute()
            )
            due_cards = resp.data or []
        except Exception:
            due_cards = []

    # Pick flashcards
    flashcards = due_cards[: rule["n_cards"]]

    # Determine topic and subject from first card (fallback to defaults)
    if flashcards:
        topic = flashcards[0].get("topic", "Newton Laws")
        subject = flashcards[0].get("subject", req.subject if req.subject != "any" else "Physics")
    else:
        topic = "Newton Laws"
        subject = req.subject if req.subject != "any" else "Physics"

    # Generate MCQs
    mcqs: list[dict[str, Any]] = []
    for _ in range(rule["n_mcq"]):
        mcq = _generate_mcq(subject, topic)
        if mcq:
            mcqs.append(mcq)

    # Generate formula
    formula = _generate_formula(subject, topic) if rule["n_formula"] > 0 else None

    total_items = len(flashcards) + len(mcqs) + (1 if formula else 0)

    return {
        "session": {
            "minutes": req.minutes,
            "topic": topic,
            "subject": subject,
            "flashcards": flashcards,
            "mcqs": mcqs,
            "formula": formula,
            "total_items": total_items,
        }
    }


@router.get("/streak/{user_id}")
async def get_streak(user_id: str) -> dict:
    """Calculate the user's micro-study streak.

    Queries the ``micro_sessions`` table for the last 30 sessions,
    then counts consecutive days backwards from today.
    """
    try:
        response = (
            get_supabase()
            .table("micro_sessions")
            .select("session_date")
            .eq("user_id", user_id)
            .order("session_date", desc=True)
            .limit(30)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sessions: {e}")

    sessions = response.data or []
    total_sessions = len(sessions)

    # Calculate streak — count consecutive days from today backwards
    streak = 0
    check_date = date.today()

    session_dates = set()
    for s in sessions:
        try:
            session_dates.add(date.fromisoformat(s["session_date"]))
        except (KeyError, ValueError):
            continue

    while check_date in session_dates:
        streak += 1
        check_date -= timedelta(days=1)

    return {"streak": streak, "total_sessions": total_sessions}


@router.post("/log")
async def log_session(req: LogRequest) -> dict:
    """Log a completed micro-study session.

    Upserts into the ``micro_sessions`` table using the
    ``(user_id, session_date)`` unique constraint.
    """
    today_iso = date.today().isoformat()

    try:
        get_supabase().table("micro_sessions").upsert(
            {
                "user_id": req.user_id,
                "session_date": today_iso,
                "subject": req.subject,
                "minutes": req.minutes,
                "items_completed": req.items_completed,
            }
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log session: {e}")

    return {"logged": True}
