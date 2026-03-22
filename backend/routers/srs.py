"""
SRS Router — spaced-repetition endpoints.

Exposes endpoints for fetching due cards, submitting reviews,
creating new cards, and retrieving study statistics.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.srs_engine import sm2, next_review_date
from services.supabase_service import (
    fetch_due_cards,
    update_card_after_review,
    log_attempt,
    get_supabase,
    get_user_stats,
)

router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────

class ReviewRequest(BaseModel):
    """Payload for submitting a card review."""
    user_id: str
    card_id: str
    score: int = Field(3, ge=0, le=5, description="Recall quality 0-5")
    time_seconds: int = 0


class CardCreateRequest(BaseModel):
    """Payload for creating a new flashcard."""
    user_id: str
    topic: str
    subject: str


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/due/{user_id}")
async def get_due_cards_endpoint(user_id: str) -> dict:
    """Return all flashcards due for review today."""
    try:
        cards = fetch_due_cards(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch due cards: {e}")
    return {"due_cards": cards, "count": len(cards)}


@router.post("/review")
async def submit_review(req: ReviewRequest) -> dict:
    """Process a single card review using the SM-2 algorithm."""
    try:
        card_resp = (
            get_supabase()
            .table("cards")
            .select("ease_factor, interval_days, repetitions, subject, topic")
            .eq("id", req.card_id)
            .single()
            .execute()
        )
        card = card_resp.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Card not found: {e}")

    ease_factor: float = card.get("ease_factor", 2.5)
    interval_days: int = card.get("interval_days", 1)
    repetitions: int = card.get("repetitions", 0)
    subject: str = card.get("subject", "Unknown")
    topic: str = card.get("topic", "Unknown")

    # Run SM-2 algorithm
    new_ef, new_interval = sm2(ease_factor, interval_days, req.score)

    # Calculate new repetitions
    if req.score >= 3:
        new_reps = repetitions + 1
    else:
        new_reps = 0

    # Calculate new due date
    new_due_date = (date.today() + timedelta(days=new_interval)).isoformat()

    # Persist updates (matches updated supabase_service signature)
    try:
        update_card_after_review(req.card_id, new_ef, new_interval, new_reps, new_due_date)
        log_attempt(
            user_id=req.user_id,
            card_id=req.card_id,
            subject=subject,
            topic=topic,
            correct=req.score >= 3,
            score=req.score,
            time_seconds=req.time_seconds,
            source="srs",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update card: {e}")

    return {
        "new_ease_factor": new_ef,
        "new_interval_days": new_interval,
        "next_review": new_due_date,
    }


@router.post("/cards")
async def create_card(req: CardCreateRequest) -> dict:
    """Insert a new flashcard into the Supabase cards table."""
    today_iso = date.today().isoformat()
    try:
        response = (
            get_supabase()
            .table("cards")
            .insert(
                {
                    "user_id": req.user_id,
                    "topic": req.topic,
                    "subject": req.subject,
                    "front": f"What is a key concept in {req.topic}?",
                    "back": f"Explain the fundamentals of {req.topic} in {req.subject}.",
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "repetitions": 0,
                    "next_review": today_iso,
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create card: {e}")
    return {"card": response.data[0] if response.data else response.data}


@router.get("/stats/{user_id}")
async def get_stats(user_id: str) -> dict:
    """Return aggregated study statistics for a user."""
    try:
        stats = get_user_stats(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {e}")
