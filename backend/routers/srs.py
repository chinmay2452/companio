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
    front: str = ""
    back: str = ""


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/due/{user_id}")
async def get_due_cards_endpoint(user_id: str) -> dict:
    """Return all flashcards due for review today."""
    try:
        cards = fetch_due_cards(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch due cards: {e}")
    return {"due_cards": cards, "count": len(cards)}


@router.get("/cards/{user_id}")
async def list_all_cards(user_id: str) -> dict:
    """Return ALL flashcards for a user (not just due ones)."""
    try:
        response = (
            get_supabase()
            .table("cards")
            .select("id, user_id, subject, topic, front, back, ease_factor, interval_days, repetitions, due_date")
            .eq("user_id", user_id)
            .order("due_date")
            .execute()
        )
        return {"cards": response.data, "count": len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list cards: {e}")


@router.post("/review")
async def submit_review(req: ReviewRequest) -> dict:
    """Process a single card review using the SM-2 algorithm."""
    from datetime import date, timedelta
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

    if req.score >= 3:
        new_interval = 1 if repetitions == 0 else (6 if repetitions == 1 else round(interval_days * ease_factor))
        new_reps = repetitions + 1
    else:
        new_reps = 0
        new_interval = 1

    new_ef = max(1.3, ease_factor + (0.1 - (5 - req.score) * (0.08 + (5 - req.score) * 0.02)))
    new_due_date = (date.today() + timedelta(days=new_interval)).isoformat()

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
    front = req.front or f"What is a key concept in {req.topic}?"
    back = req.back or f"Explain the fundamentals of {req.topic} in {req.subject}."
    try:
        response = (
            get_supabase()
            .table("cards")
            .insert(
                {
                    "user_id": req.user_id,
                    "topic": req.topic,
                    "subject": req.subject,
                    "front": front,
                    "back": back,
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "repetitions": 0,
                    "due_date": today_iso,
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create card: {e}")
    return {"card": response.data[0] if response.data else response.data}


@router.delete("/cards/clear/{user_id}")
async def clear_all_data(user_id: str) -> dict:
    """⚠️ Wipe ALL data for a user: cards, attempts, plans, weak_topics."""
    sb = get_supabase()
    deleted = {}
    for table in ["attempts", "weak_topics", "daily_plans", "cards"]:
        try:
            res = sb.table(table).delete().eq("user_id", user_id).execute()
            deleted[table] = len(res.data) if res.data else 0
        except Exception as e:
            deleted[table] = f"error: {e}"
    return {"cleared": deleted}


@router.delete("/cards/{card_id}")
async def delete_card(card_id: str) -> dict:
    """Delete a single flashcard by ID."""
    try:
        # Also remove related attempts
        get_supabase().table("attempts").delete().eq("card_id", card_id).execute()
        get_supabase().table("cards").delete().eq("id", card_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete card: {e}")
    return {"deleted": card_id}


@router.get("/stats/{user_id}")
async def get_stats(user_id: str) -> dict:
    """Return aggregated study statistics for a user."""
    try:
        stats = get_user_stats(user_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {e}")
