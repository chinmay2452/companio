"""
SRS Router — spaced-repetition endpoints.

Exposes endpoints for fetching due cards, submitting reviews,
creating new cards, and retrieving study statistics.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.srs_engine import sm2, next_review_date
from services.supabase_service import (
    fetch_due_cards,
    update_card_after_review,
    log_attempt,
    get_supabase,
)

router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────

class ReviewRequest(BaseModel):
    """Payload for submitting a card review."""
    user_id: str
    card_id: str
    score: int = Field(..., ge=0, le=5, description="Recall quality 0-5")
    time_seconds: int = 0


class CardCreateRequest(BaseModel):
    """Payload for creating a new flashcard."""
    user_id: str
    topic: str
    subject: str


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/due/{user_id}")
async def get_due_cards(user_id: str) -> dict:
    """Return all flashcards due for review today."""
    try:
        cards = fetch_due_cards(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch due cards: {e}")
    return {"due_cards": cards, "count": len(cards)}


@router.post("/review")
async def submit_review(req: ReviewRequest) -> dict:
    """Process a single card review using the SM-2 algorithm.

    Fetches the card's current ease_factor and interval_days from
    Supabase, runs SM-2, then persists updated scheduling data.
    """
    try:
        # Fetch current card data from Supabase
        card_resp = (
            get_supabase()
            .table("cards")
            .select("ease_factor, interval_days")
            .eq("id", req.card_id)
            .single()
            .execute()
        )
        card = card_resp.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Card not found: {e}")

    ease_factor: float = card.get("ease_factor", 2.5)
    interval_days: int = card.get("interval_days", 1)

    # Run SM-2 algorithm
    new_ef, new_interval = sm2(ease_factor, interval_days, req.score)

    # Persist updates
    try:
        update_card_after_review(req.card_id, new_ef, new_interval)
        log_attempt(req.user_id, req.card_id, req.score, req.time_seconds)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update card: {e}")

    return {
        "new_ease_factor": new_ef,
        "new_interval_days": new_interval,
        "next_review": next_review_date(new_interval),
    }


@router.post("/cards")
async def create_card(req: CardCreateRequest) -> dict:
    """Insert a new flashcard into the Supabase cards table."""
    try:
        response = (
            get_supabase()
            .table("cards")
            .insert(
                {
                    "user_id": req.user_id,
                    "topic": req.topic,
                    "subject": req.subject,
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "next_review": next_review_date(0),  # due today
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create card: {e}")
    return {"card": response.data[0] if response.data else response.data}


@router.get("/stats/{user_id}")
async def get_stats(user_id: str) -> dict:
    """Return aggregated study statistics for a user.

    - total_cards: count of all cards
    - cards_by_subject: cards grouped by subject with counts
    - avg_score: average score across all attempts
    """
    try:
        # Total cards
        cards_resp = (
            get_supabase()
            .table("cards")
            .select("id, subject")
            .eq("user_id", user_id)
            .execute()
        )
        cards = cards_resp.data
        total_cards = len(cards)

        # Group by subject
        subject_counts: dict[str, int] = {}
        for card in cards:
            subj = card.get("subject", "unknown")
            subject_counts[subj] = subject_counts.get(subj, 0) + 1
        cards_by_subject = [
            {"subject": s, "count": c} for s, c in subject_counts.items()
        ]

        # Average score from attempts
        attempts_resp = (
            get_supabase()
            .table("attempts")
            .select("score")
            .eq("user_id", user_id)
            .execute()
        )
        attempts = attempts_resp.data
        if attempts:
            avg_score = round(
                sum(a["score"] for a in attempts) / len(attempts), 2
            )
        else:
            avg_score = 0.0

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {e}")

    return {
        "total_cards": total_cards,
        "avg_score": avg_score,
        "cards_by_subject": cards_by_subject,
    }
