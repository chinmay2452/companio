from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import traceback

from services.supabase_service import (
    fetch_due_cards,
    update_card_after_review,
    log_attempt,
    get_weak_topics,
    supabase
)
from services.ai_service import generate_mcq

router = APIRouter(tags=["microtime"])

class StartSessionRequest(BaseModel):
    user_id: str
    duration_minutes: int
    subject: Optional[str] = None

class ItemResult(BaseModel):
    type: str # "flashcard" or "mcq"
    card_id: Optional[str] = None
    correct: bool
    time_seconds: float
    subject: Optional[str] = None
    topic: Optional[str] = None

class CompleteSessionRequest(BaseModel):
    session_id: str
    user_id: str
    items_result: List[ItemResult]

@router.post("/session/start")
def start_session(req: StartSessionRequest):
    if req.duration_minutes not in [2, 5, 10]:
        raise HTTPException(status_code=400, detail="Invalid duration. Must be 2, 5, or 10 minutes.")
    
    try:
        # Determine composition based on duration
        num_cards = 2
        num_mcqs = 0
        if req.duration_minutes == 5:
            num_cards = 2
            num_mcqs = 1
        elif req.duration_minutes == 10:
            num_cards = 3
            num_mcqs = 2

        # Fetch due cards
        due_cards = fetch_due_cards(req.user_id, limit=num_cards)
        
        content = []
        for card in due_cards:
            content.append({
                "type": "flashcard",
                "card_id": card["id"],
                "front": card["front"],
                "back": card["back"],
                "subject": card["subject"],
                "topic": card["topic"]
            })
            
        # Generate MCQs if needed (fallback if not enough weak topics)
        if num_mcqs > 0:
            weak_topics = get_weak_topics(req.user_id, limit=num_mcqs)
            topics_to_generate = [wt["topic"] for wt in weak_topics]
            
            while len(topics_to_generate) < num_mcqs:
                topics_to_generate.append("General Science") # Generic fallback
                
            for topic in topics_to_generate[:num_mcqs]:
                mcq_data = generate_mcq(topic=topic, difficulty="medium")
                content.append({
                    "type": "mcq",
                    "topic": topic,
                    "question": mcq_data.get("question", "Question?"),
                    "options": mcq_data.get("options", ["A", "B", "C", "D"]),
                    "correct_index": mcq_data.get("correct_index", 0)
                })
        
        # Insert new micro_sessions row
        session_data = {
            "user_id": req.user_id,
            "duration_minutes": req.duration_minutes,
            "completed": False
        }
        session_res = supabase.table("micro_sessions").insert(session_data).execute()
        if not session_res.data:
            raise Exception("Failed to serialize session row in DB")
        
        session_id = session_res.data[0]["id"]
        
        return {
            "session_id": session_id,
            "content": content,
            "duration_minutes": req.duration_minutes
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/complete")
def complete_session(req: CompleteSessionRequest):
    try:
        total_items = len(req.items_result)
        correct_count = 0
        cards_reviewed = 0
        mcqs_attempted = 0
        
        for item in req.items_result:
            if item.correct:
                correct_count += 1
                
            if item.type == "flashcard" and item.card_id:
                cards_reviewed += 1
                score = 4 if item.correct else 1
                
                # Fetch old SM-2 data to compute new
                card_res = supabase.table("cards").select("ease_factor, interval_days, repetitions").eq("id", item.card_id).execute()
                if card_res.data:
                    c = card_res.data[0]
                    ef = c["ease_factor"]
                    rep = c["repetitions"]
                    inter = c["interval_days"]
                    
                    if score >= 3:
                        new_inter = 1 if rep == 0 else (6 if rep == 1 else round(inter * ef))
                        new_rep = rep + 1
                    else:
                        new_rep = 0
                        new_inter = 1
                        
                    new_ef = max(1.3, ef + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)))
                    
                    from datetime import date, timedelta
                    new_due_date = (date.today() + timedelta(days=new_inter)).isoformat()
                    
                    update_card_after_review(item.card_id, new_ef, new_inter, new_rep, new_due_date)
            else:
                mcqs_attempted += 1

            # Log the attempt universally
            log_attempt(
                user_id=req.user_id,
                card_id=item.card_id,
                subject=item.subject or "Unknown",
                topic=item.topic or "Unknown",
                correct=item.correct,
                score=4 if item.correct else 1,
                time_seconds=item.time_seconds,
                source="microtime" # as per requirements in prompt 4
            )

        # Update Session Row
        now_str = datetime.utcnow().isoformat()
        update_data = {
            "completed": True,
            "completed_at": now_str,
            "cards_reviewed": cards_reviewed,
            "mcqs_attempted": mcqs_attempted,
            "correct_count": correct_count,
            "total_items": total_items
        }
        supabase.table("micro_sessions").update(update_data).eq("id", req.session_id).execute()

        # Database Postgres trigger handles streak update automatically. Fetch streak.
        streak_res = supabase.table("micro_streaks").select("current_streak").eq("user_id", req.user_id).execute()
        current_streak = streak_res.data[0]["current_streak"] if streak_res.data else 0
        
        accuracy = (correct_count / total_items * 100) if total_items > 0 else 0
        
        if accuracy >= 80:
            msg = "Excellent work! Keep it up!"
        elif accuracy >= 50:
            msg = "Good effort, but room for improvement."
        else:
            msg = "Don't give up! Review your weak topics."

        return {
            "streak": current_streak,
            "accuracy": accuracy,
            "message": msg
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/streak/{user_id}")
def get_streak(user_id: str):
    try:
        res = supabase.table("micro_streaks").select("*").eq("user_id", user_id).execute()
        if not res.data:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "total_sessions": 0,
                "total_minutes": 0
            }
        return res.data[0]
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
