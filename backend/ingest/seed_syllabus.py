"""
Seed Syllabus — inserts 30 JEE / NEET topic cards into Supabase for demo.

Creates one flashcard per topic across Physics, Chemistry, Biology, and
Maths so the SRS, planner, and micro-time features have data to work with
immediately after setup.

Usage:
    python ingest/seed_syllabus.py --user_id <uuid>
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

from services.supabase_service import get_supabase


# ── Syllabus topics ──────────────────────────────────────────────────

TOPICS: dict[str, list[str]] = {
    "Physics": [
        "Newton Laws",
        "Kinematics",
        "Work Energy Power",
        "Gravitation",
        "Electrostatics",
        "Current Electricity",
        "Magnetism",
        "Optics",
        "Thermodynamics",
        "Modern Physics",
    ],
    "Chemistry": [
        "Atomic Structure",
        "Chemical Bonding",
        "Electrochemistry",
        "Organic Reactions",
        "Thermochemistry",
        "Equilibrium",
        "Coordination Compounds",
        "Polymers",
    ],
    "Biology": [
        "Cell Biology",
        "Genetics",
        "Evolution",
        "Human Physiology",
        "Plant Physiology",
        "Ecology",
        "Biotechnology",
    ],
    "Maths": [
        "Calculus",
        "Integration",
        "Vectors",
        "Matrices",
        "Probability",
        "Complex Numbers",
        "Trigonometry",
    ],
}


# ── Seed function ────────────────────────────────────────────────────

def seed(user_id: str) -> None:
    """Insert all topic cards for the given user into Supabase."""
    supabase = get_supabase()
    today_iso = date.today().isoformat()

    cards: list[dict] = []
    for subject, topics in TOPICS.items():
        for topic in topics:
            cards.append(
                {
                    "user_id": user_id,
                    "topic": topic,
                    "subject": subject,
                    "ease_factor": 2.5,
                    "interval_days": 1,
                    "next_review": today_iso,
                }
            )

    print(f"Seeding {len(cards)} cards for user {user_id} ...")

    # Insert in one batch (Supabase supports bulk insert)
    try:
        response = supabase.table("cards").insert(cards).execute()
        inserted = len(response.data) if response.data else 0
        print(f"Done! {inserted} cards inserted.")
    except Exception as e:
        print(f"Error inserting cards: {e}")
        sys.exit(1)

    # Print summary
    for subject, topics in TOPICS.items():
        print(f"  {subject}: {len(topics)} topics")


# ── CLI entry point ──────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed 30 JEE/NEET topic cards into Supabase for demo."
    )
    parser.add_argument(
        "--user_id",
        required=True,
        help="UUID of the user to seed cards for",
    )
    args = parser.parse_args()

    seed(args.user_id)
