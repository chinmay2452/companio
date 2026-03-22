import os
from datetime import date, timedelta
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fetch_due_cards(user_id: str, limit: int = 20) -> list[dict]:
    try:
        today_str = date.today().isoformat()
        response = supabase.table("cards").select(
            "id, subject, topic, front, back, ease_factor, interval_days, repetitions"
        ).eq("user_id", user_id).lte("due_date", today_str).order("due_date").order("ease_factor").limit(limit).execute()
        return response.data
    except Exception as e:
        print(f"Error in fetch_due_cards: {e}")
        raise

def update_card_after_review(card_id: str, ease_factor: float, interval_days: int, repetitions: int, due_date: str) -> dict:
    try:
        response = supabase.table("cards").update({
            "ease_factor": ease_factor,
            "interval_days": interval_days,
            "repetitions": repetitions,
            "due_date": due_date
        }).eq("id", card_id).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"Error in update_card_after_review: {e}")
        raise

def log_attempt(user_id: str, card_id: str | None, subject: str, topic: str, correct: bool, score: int, time_seconds: float, source: str = "practice") -> dict:
    try:
        data = {
            "user_id": user_id,
            "card_id": card_id,
            "subject": subject,
            "topic": topic,
            "correct": correct,
            "score": score,
            "time_seconds": time_seconds,
            "source": source
        }
        response = supabase.table("attempts").insert(data).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"Error in log_attempt: {e}")
        raise

def save_daily_plan(user_id: str, plan_date: str, plan_json: list, total_minutes: int) -> dict:
    try:
        data = {
            "user_id": user_id,
            "plan_date": plan_date,
            "plan_json": plan_json,
            "total_minutes": total_minutes
        }
        response = supabase.table("daily_plans").upsert(data, on_conflict="user_id,plan_date").execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"Error in save_daily_plan: {e}")
        raise

def get_weak_topics(user_id: str, limit: int = 10) -> list[dict]:
    try:
        response = supabase.table("weak_topics").select(
            "subject, topic, accuracy, attempts_count"
        ).eq("user_id", user_id).order("accuracy").limit(limit).execute()
        return response.data
    except Exception as e:
        print(f"Error in get_weak_topics: {e}")
        raise

def get_user_stats(user_id: str) -> dict:
    try:
        today_str = date.today().isoformat()
        
        due_res = supabase.table("cards").select("id", count="exact").eq("user_id", user_id).lte("due_date", today_str).execute()
        cards_due_today = due_res.count if due_res.count is not None else (len(due_res.data) if due_res.data else 0)
        
        total_res = supabase.table("cards").select("id", count="exact").eq("user_id", user_id).execute()
        total_cards = total_res.count if total_res.count is not None else (len(total_res.data) if total_res.data else 0)
        
        streak_res = supabase.table("micro_streaks").select("current_streak").eq("user_id", user_id).execute()
        streak = streak_res.data[0].get("current_streak", 0) if streak_res.data else 0
        
        week_ago_str = (date.today() - timedelta(days=7)).isoformat()
        plans_res = supabase.table("daily_plans").select("id", count="exact").eq("user_id", user_id).gte("plan_date", week_ago_str).execute()
        plans_this_week = plans_res.count if plans_res.count is not None else (len(plans_res.data) if plans_res.data else 0)
        
        return {
            "cards_due_today": cards_due_today,
            "total_cards": total_cards,
            "streak": streak,
            "plans_this_week": plans_this_week
        }
    except Exception as e:
        print(f"Error in get_user_stats: {e}")
        raise

def upsert_weak_topic(user_id: str, subject: str, topic: str, accuracy: float, avg_time_sec: float, attempts_count: int) -> dict:
    try:
        data = {
            "user_id": user_id,
            "subject": subject,
            "topic": topic,
            "accuracy": accuracy,
            "avg_time_sec": avg_time_sec,
            "attempts_count": attempts_count
        }
        response = supabase.table("weak_topics").upsert(data, on_conflict="user_id,subject,topic").execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"Error in upsert_weak_topic: {e}")
        raise
