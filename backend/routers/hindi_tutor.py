"""
Hindi Tutor Router — Hindi / Hinglish voice-friendly AI tutor.

Provides concise, spoken-aloud-ready explanations in Hindi and Hinglish
for JEE / NEET / UPSC students. Supports both regular and SSE streaming.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_service import chat, stream_chat, QUALITY_MODEL

router = APIRouter()

def _get_system_prompt(language: str) -> str:
    dialect = "pure Hindi" if language == "hi-IN" else "Hinglish (a mix of English vocabulary and Hindi grammar)"
    return (
        f"Aap ek expert JEE/NEET/UPSC tutor hain jo {dialect} mein padhate hain.\n"
        "Rules:\n"
        f"- Hamesha apna jawab deeply {dialect} mein likho.\n"
        "- Detail mein jawab do taki student topic ko deeply samajh sake.\n"
        "- Har concept ka ek clear example zaroor do.\n"
        "- Agar koi formula hai, toh use simple shabdon mein tod kar samjhao (break it down).\n"
        "- Step by step batao for complex concepts."
    )


# ── Request Models ───────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: str
    content: str


class HindiRequest(BaseModel):
    """Payload for asking the Hindi tutor a question."""
    question: str
    subject: str
    user_id: str
    language: str = "hi-IN"
    history: list[ChatMessage] = []


class HindiStreamRequest(BaseModel):
    """Payload for a streaming Hindi tutor response."""
    question: str
    subject: str
    user_id: str
    language: str = "hi-IN"
    history: list[ChatMessage] = []


# ── Helpers ──────────────────────────────────────────────────────────

def _build_hindi_messages(
    question: str,
    subject: str,
    history: list[ChatMessage],
    language: str,
) -> list[dict[str, str]]:
    """Build the messages list with system prompt, recent history, and user query."""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _get_system_prompt(language)},
    ]
    # Include last 6 messages from history for context
    for msg in history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})
    # Add the current question with subject prefix
    messages.append({
        "role": "user",
        "content": f"{subject} ka sawaal: {question}",
    })
    return messages


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/hindi")
async def ask_hindi(req: HindiRequest) -> dict:
    """Answer a student's question in Hindi / Hinglish.

    Builds a conversation with the Hindi system prompt, includes
    recent chat history (up to 6 messages), and returns a concise,
    voice-friendly answer.
    """
    messages = _build_hindi_messages(req.question, req.subject, req.history, req.language)

    try:
        answer: str = chat(messages, model=QUALITY_MODEL, max_tokens=512)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hindi tutor failed: {e}")

    return {"answer": answer}


@router.post("/hindi/stream")
async def stream_hindi(req: HindiStreamRequest) -> StreamingResponse:
    """Stream a Hindi tutor response as Server-Sent Events.

    Same logic as ``/hindi`` but yields chunks via SSE for
    real-time voice synthesis on the frontend.
    """
    messages = _build_hindi_messages(req.question, req.subject, req.history, req.language)

    async def event_generator():
        try:
            for chunk in stream_chat(messages, model=QUALITY_MODEL):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
