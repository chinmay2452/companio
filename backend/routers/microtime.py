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
    topic: Optional[str] = None

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
        from services.ai_service import generate_formula

        # Determine composition based on duration
        num_flashcards = 2
        num_mcqs = 1
        num_formulas = 0
        if req.duration_minutes == 5:
            num_flashcards = 2
            num_mcqs = 2
            num_formulas = 1
        elif req.duration_minutes == 10:
            num_flashcards = 3
            num_mcqs = 3
            num_formulas = 2

        content = []
        subject_label = req.subject or "General Science"
        topic_label = req.topic or "Key Concepts"

        # ── 1. Try to fetch existing SRS flashcards from Supabase (optional) ──
        due_cards = []
        try:
            due_cards = fetch_due_cards(req.user_id, limit=num_flashcards, subject=req.subject, topic=req.topic)
        except Exception:
            pass  # Supabase may not have this table; we'll generate AI flashcards instead

        for card in due_cards:
            content.append({
                "type": "flashcard",
                "card_id": card["id"],
                "front": card["front"],
                "back": card["back"],
                "subject": card.get("subject", subject_label),
                "topic": card.get("topic", topic_label)
            })

        # ── 2. Fill remaining flashcard slots with AI-generated flashcards ──
        remaining_flashcards = num_flashcards - len(due_cards)
        if remaining_flashcards > 0:
            for _ in range(remaining_flashcards):
                f_data = generate_formula(topic_label, subject_label)
                content.append({
                    "type": "flashcard",
                    "card_id": None,
                    "front": f"What is {f_data.get('formula_text', topic_label)}?",
                    "back": f_data.get("explanation", f"Review {topic_label} in {subject_label}."),
                    "subject": subject_label,
                    "topic": topic_label
                })

        # ── 3. Generate MCQs via Groq LLM ──
        mcq_topic = topic_label
        for _ in range(num_mcqs):
            mcq_data = generate_mcq(topic=mcq_topic, difficulty="medium")
            content.append({
                "type": "mcq",
                "topic": mcq_topic,
                "question": mcq_data.get("question", "Question?"),
                "options": mcq_data.get("options", ["A", "B", "C", "D"]),
                "correct_index": mcq_data.get("correct_index", 0),
                "explanation": mcq_data.get("explanation", ""),
                "subject": subject_label,
            })

        # ── 4. Generate formulas via Groq LLM ──
        for _ in range(num_formulas):
            f_data = generate_formula(topic_label, subject_label)
            content.append({
                "type": "formula",
                "topic": topic_label,
                "formula_text": f_data.get("formula_text", "Concept!"),
                "explanation": f_data.get("explanation", "Review this."),
                "subject": subject_label,
            })
        
        # ── 5. Create session ID (Supabase optional) ──
        session_id = f"ai_session_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        try:
            if req.user_id != "00000000-0000-0000-0000-000000000000":
                session_data = {
                    "user_id": req.user_id,
                    "duration_minutes": req.duration_minutes,
                    "completed": False
                }
                session_res = supabase.table("micro_sessions").insert(session_data).execute()
                if session_res.data:
                    session_id = session_res.data[0]["id"]
        except Exception:
            pass  # DB insert failed; use generated session_id
        
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
                
                # Try SRS card update (optional — may not exist)
                try:
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
                except Exception:
                    pass  # Card may be AI-generated with no DB entry
            else:
                mcqs_attempted += 1

            # Log the attempt (optional)
            try:
                if req.user_id != "00000000-0000-0000-0000-000000000000":
                    log_attempt(
                        user_id=req.user_id,
                        card_id=item.card_id,
                        subject=item.subject or "Unknown",
                        topic=item.topic or "Unknown",
                        correct=item.correct,
                        score=4 if item.correct else 1,
                        time_seconds=item.time_seconds,
                        source="microtime"
                    )
            except Exception:
                pass

        accuracy = (correct_count / total_items * 100) if total_items > 0 else 0
        current_streak = 0

        # Try to update session and fetch streak (optional)
        try:
            if req.user_id != "00000000-0000-0000-0000-000000000000":
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

                streak_res = supabase.table("micro_streaks").select("current_streak").eq("user_id", req.user_id).execute()
                current_streak = streak_res.data[0]["current_streak"] if streak_res.data else 0
        except Exception:
            pass
        
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

class GenerateEquationsRequest(BaseModel):
    subject: str
    topic: str
    count: Optional[int] = 5

@router.post("/generate_equations")
def generate_equations(req: GenerateEquationsRequest):
    try:
        from services.ai_service import generate_microtime_equations
        equations = generate_microtime_equations(req.subject, req.topic, req.count)
        return {"equations": equations}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
