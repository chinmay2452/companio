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

# ── System Prompt (exact spec) ───────────────────────────────────────

HINDI_SYSTEM_PROMPT = (
    "Aap ek expert JEE/NEET/UPSC tutor hain jo Hindi aur Hinglish mein padhate hain.\n"
    "Rules:\n"
    "- Hamesha simple Hindi ya Hinglish mein jawab do\n"
    "- Short answers — max 4-5 sentences (will be spoken aloud)\n"
    "- Examples zaroor do\n"
    "- Formulas ko simple shabdon mein samjhao\n"
    "- Step by step batao for complex concepts"
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
    history: list[ChatMessage] = []


class HindiStreamRequest(BaseModel):
    """Payload for a streaming Hindi tutor response."""
    question: str
    subject: str
    user_id: str
    history: list[ChatMessage] = []


# ── Helpers ──────────────────────────────────────────────────────────

def _build_hindi_messages(
    question: str,
    subject: str,
    history: list[ChatMessage],
) -> list[dict[str, str]]:
    """Build the messages list with system prompt, recent history, and user query."""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": HINDI_SYSTEM_PROMPT},
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
    messages = _build_hindi_messages(req.question, req.subject, req.history)

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
    messages = _build_hindi_messages(req.question, req.subject, req.history)

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
