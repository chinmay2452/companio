import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
from supabase import create_client, Client

def seed():
    # Setup Supabase client from env
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env variables")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Starting database seeding...")
    
    # -------------------------------------------------------------------------
    # STEP 1: Create Demo User
    # -------------------------------------------------------------------------
    demo_email = "demo@companio.app"
    user_id = None
    
    try:
        users_res = supabase.auth.admin.list_users()
        users = users_res.users if hasattr(users_res, 'users') else users_res
        for u in users:
            if u.email == demo_email:
                user_id = u.id
                break
    except Exception as e:
        print(f"Warning checking users list: {e}")
        
    if not user_id:
        try:
            new_user = supabase.auth.admin.create_user({
                "email": demo_email,
                "password": "Demo@2026",
                "email_confirm": True,
                "user_metadata": {"name": "Arjun Sharma", "exam_type": "JEE"}
            })
            user_id = new_user.user.id
            print(f"✓ Demo user created: {demo_email}")
        except Exception as e:
            print(f"Failed to create user: {e}")
            return
    else:
        print(f"✓ Demo user already exists: {demo_email}")

    # Ensure public.users row
    try:
        supabase.table("users").upsert({
            "id": user_id,
            "email": demo_email,
            "name": "Arjun Sharma",
            "exam_type": "JEE"
        }).execute()
    except Exception as e:
        pass # Ignore if table doesn't exist or isn't strictly required by schema

    # -------------------------------------------------------------------------
    # STEP 2: Insert 35 JEE cards
    # -------------------------------------------------------------------------
    # Clean up old cards for this user for a fresh seed
    supabase.table("cards").delete().eq("user_id", user_id).execute()

    cards_data = []
    
    physics_topics = ["Kinematics", "Newton's Laws", "Work-Energy", "Waves", "Thermodynamics", "Electrostatics", "Magnetism", "Modern Physics"]
    chem_topics = ["Periodic Table", "Chemical Bonding", "Organic Basics", "Electrochemistry", "Equilibrium", "Thermochemistry"]
    math_topics = ["Quadratic Equations", "Trigonometry", "Calculus Basics", "Vectors", "Probability", "Matrices"]
    
    def add_card(subj, topic, index):
        # 5 due today, 8 overdue, rest 1-7 days in future
        total = len(cards_data)
        if total < 5:
            days_offset = 0 # today
        elif total < 13:
            days_offset = -random.randint(1, 10) # overdue
        else:
            days_offset = random.randint(1, 7) # future
            
        due_date = (datetime.utcnow() + timedelta(days=days_offset)).date().isoformat()
        ef = round(random.uniform(1.8, 2.8), 2)
        rep = random.randint(0, 5)
        
        cards_data.append({
            "user_id": user_id,
            "subject": subj,
            "topic": topic,
            "front": f"State a core concept or law related to {topic} ({index})",
            "back": f"This is the detailed explanation for the concept in {topic}. It involves key formulas and standard derivations heavily tested in JEE.",
            "due_date": due_date,
            "ease_factor": ef,
            "repetitions": rep,
            "interval_days": max(1, rep * 2)
        })

    # Physics: 12 cards
    for i in range(12):
        add_card("Physics", physics_topics[i % len(physics_topics)], i+1)
        
    # Chemistry: 12 cards
    for i in range(12):
        add_card("Chemistry", chem_topics[i % len(chem_topics)], i+1)
        
    # Maths: 11 cards
    for i in range(11):
        add_card("Maths", math_topics[i % len(math_topics)], i+1)
        
    cards_res = supabase.table("cards").insert(cards_data).execute()
    print("✓ 35 cards inserted (varying due dates & ease factors)")
    
    inserted_cards = cards_res.data

    # -------------------------------------------------------------------------
    # STEP 3: Insert 60 attempts
    # -------------------------------------------------------------------------
    supabase.table("attempts").delete().eq("user_id", user_id).execute()
    
    attempts_data = []
    sources = ['practice', 'srs', 'microtime']
    
    for i in range(60):
        # Generate target subject accurately based on counts
        if i < 20:
            subj = "Physics"
            correct = random.random() < 0.58
        elif i < 40:
            subj = "Chemistry"
            correct = random.random() < 0.72
        else:
            subj = "Maths"
            correct = random.random() < 0.64
            
        # Select appropriate topic mapping to subject
        if subj == "Physics":
            topic = random.choice(physics_topics)
        elif subj == "Chemistry":
             topic = random.choice(chem_topics)
        else:
             topic = random.choice(math_topics)
             
        # Force Kinematics to be specifically weak (< 30% acc)
        if topic == "Kinematics":
            correct = random.random() < 0.28
            
        card_pool = [c for c in inserted_cards if c["subject"] == subj and c["topic"] == topic]
        card_id = random.choice(card_pool)["id"] if card_pool else None
        
        days_ago = random.randint(0, 7)
        created_at = (datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(1, 12))).isoformat()
        
        attempts_data.append({
            "user_id": user_id,
            "card_id": card_id,
            "subject": subj,
            "topic": topic,
            "correct": correct,
            "score": 4 if correct else 1,
            "time_seconds": random.randint(15, 120),
            "source": random.choice(sources),
            "created_at": created_at
        })
        
    supabase.table("attempts").insert(attempts_data).execute()
    print("✓ 60 attempts inserted (simulating past 7 days)")

    # -------------------------------------------------------------------------
    # STEP 4: Compute weak topics and UPSERT
    # -------------------------------------------------------------------------
    supabase.table("weak_topics").delete().eq("user_id", user_id).execute()
    
    topic_stats = {}
    for att in attempts_data:
        key = (att["subject"], att["topic"])
        if key not in topic_stats:
            topic_stats[key] = {"correct": 0, "total": 0, "time": 0}
        
        topic_stats[key]["total"] += 1
        topic_stats[key]["time"] += att["time_seconds"]
        if att["correct"]:
            topic_stats[key]["correct"] += 1
            
    weak_topics_data = []
    for (subj, topic), stats in topic_stats.items():
        acc = (stats["correct"] / stats["total"]) * 100
        avg_time = stats["time"] / stats["total"]
        weak_topics_data.append({
            "user_id": user_id,
            "subject": subj,
            "topic": topic,
            "accuracy": acc,
            "avg_time_sec": avg_time,
            "attempts_count": stats["total"]
        })
        
    supabase.table("weak_topics").insert(weak_topics_data).execute()
    print("✓ Weak topics computed & inserted (Kinematics forced weak)")

    # -------------------------------------------------------------------------
    # STEP 5: Insert today's daily plan
    # -------------------------------------------------------------------------
    today_str = datetime.utcnow().date().isoformat()
    supabase.table("daily_plans").delete().eq("user_id", user_id).eq("plan_date", today_str).execute()
    
    plan_json = [
        {"time":"07:00", "subject":"Physics", "topic":"Kinematics", "duration_min":45, "priority":"high", "reason":"Weak area"},
        {"time":"08:00", "subject":"Chemistry", "topic":"Organic Basics", "duration_min":30, "priority":"medium", "reason":"Due for revision"},
        {"time":"09:00", "subject":"Maths", "topic":"Calculus Basics", "duration_min":45, "priority":"high", "reason":"Exam in 12 days"},
        {"time":"17:00", "subject":"Physics", "topic":"Thermodynamics", "duration_min":30, "priority":"medium", "reason":"Weekly maintenance"},
        {"time":"18:00", "subject":"Chemistry", "topic":"Equilibrium", "duration_min":30, "priority":"low", "reason":"Foundation"}
    ]
    
    supabase.table("daily_plans").insert({
        "user_id": user_id,
        "plan_date": today_str,
        "plan_json": plan_json,
        "total_minutes": 180
    }).execute()
    print("✓ Today's daily plan inserted (3 solid hours scheduled)")

    # -------------------------------------------------------------------------
    # STEP 6: Insert micro session history (3-day streak)
    # -------------------------------------------------------------------------
    supabase.table("micro_sessions").delete().eq("user_id", user_id).execute()
    
    sessions_data = []
    for i in range(3):
        # Today, yesterday, day before yesterday
        s_date = (datetime.utcnow() - timedelta(days=i)).isoformat()
        sessions_data.append({
            "user_id": user_id,
            "duration_minutes": 5,
            "completed": True,
            "completed_at": s_date,
            "cards_reviewed": 2,
            "mcqs_attempted": 1,
            "correct_count": random.randint(1, 3),
            "total_items": 3
        })
        
    supabase.table("micro_sessions").insert(sessions_data).execute()
    print("✓ 3 Micro sessions inserted (active 3-day streak triggered!)")
    
    print("\n---------------------------------------------------------")
    print("🎉 SEEDING COMPLETE! You can now test the frontend securely.")
    print("---------------------------------------------------------")

if __name__ == "__main__":
    seed()
