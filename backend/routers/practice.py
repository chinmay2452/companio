"""
Practice Router — adaptive MCQ generation.

Generates multiple-choice questions tailored to the student's
preparation level and target exam.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import chat, FAST_MODEL

router = APIRouter()


class MCQRequest(BaseModel):
    """Payload for requesting practice MCQs."""

    subject: str
    topic: str
    exam: str  # "JEE", "NEET", "UPSC"
    difficulty: str = "medium"  # easy | medium | hard
    count: int = 5


@router.post("/generate")
async def generate_mcqs(req: MCQRequest) -> dict:
    """Generate adaptive multiple-choice questions via AI."""
    messages = [
        {
            "role": "system",
            "content": (
                f"You are a {req.exam} question setter. "
                "Generate MCQs in JSON format."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate {req.count} {req.difficulty}-level MCQs on "
                f"{req.topic} ({req.subject}) for {req.exam}. "
                "Return JSON array of {{question, options: [A,B,C,D], "
                "correct_answer, explanation}}."
            ),
        },
    ]

    result: str = chat(messages, model=FAST_MODEL)
    return {"mcqs": result}
