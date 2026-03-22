"""
SRS Router — spaced-repetition endpoints.

Exposes endpoints for fetching due cards and submitting reviews.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.srs_engine import sm2, next_review_date
from services.supabase_service import (
    fetch_due_cards,
    update_card_after_review,
    log_attempt,
)

router = APIRouter()


class ReviewRequest(BaseModel):
    """Payload for submitting a card review."""

    user_id: str
    card_id: str
    score: int  # 0-5
    ease_factor: float
    interval: int
    time_seconds: int = 0


@router.get("/due/{user_id}")
async def get_due_cards(user_id: str) -> dict:
    """Return all flashcards due for review today."""
    cards = fetch_due_cards(user_id)
    return {"due_cards": cards, "count": len(cards)}


@router.post("/review")
async def submit_review(req: ReviewRequest) -> dict:
    """Process a single card review using the SM-2 algorithm."""
    new_ef, new_interval = sm2(req.ease_factor, req.interval, req.score)
    update_card_after_review(req.card_id, new_ef, new_interval)
    log_attempt(req.user_id, req.card_id, req.score, req.time_seconds)
    return {
        "new_ease_factor": new_ef,
        "new_interval": new_interval,
        "next_review": next_review_date(new_interval),
    }
