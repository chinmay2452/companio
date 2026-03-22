"""
Tutor Router — RAG-powered AI tutor.

Retrieves relevant NCERT context from ChromaDB and generates
detailed explanations using the highest-quality Groq model.
Supports single-turn, streaming, and multi-turn chat.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_service import (
    chat,
    stream_chat,
    query_context,
    QUALITY_MODEL,
)

router = APIRouter()


# ── System Prompts ───────────────────────────────────────────────────

GROUNDED_SYSTEM_PROMPT = (
    "You are an expert NCERT-based tutor. "
    "The following context chunks come from NCERT textbooks. "
    "Answer the student's question using ONLY the information in the provided context. "
    "If the context does not contain enough information to answer, "
    "say so clearly — do NOT hallucinate or guess. "
    "Provide step-by-step explanations where appropriate."
)

GENERAL_SYSTEM_PROMPT = (
    "You are an expert tutor for Indian competitive exams (JEE / NEET / UPSC). "
    "Give a clear, step-by-step explanation. "
    "Cite NCERT concepts when relevant."
)

STREAMING_SYSTEM_PROMPT = (
    "You are an expert NCERT-based tutor. "
    "Answer ONLY from the provided NCERT context below. "
    "If the answer is not in the context, say so clearly — "
    "do NOT hallucinate or make up information. "
    "Give a detailed, step-by-step explanation."
)


# ── Request Models ───────────────────────────────────────────────────

class AskRequest(BaseModel):
    """Payload for asking the tutor a single question."""
    question: str
    subject: str
    user_id: str


class StreamRequest(BaseModel):
    """Payload for a streaming tutor response."""
    question: str
    subject: str
    user_id: str


class ChatMessage(BaseModel):
    """A single message in a multi-turn conversation."""
    role: str
    content: str


class ChatRequest(BaseModel):
    """Payload for multi-turn tutor conversation."""
    messages: list[ChatMessage]
    subject: str
    user_id: str


# ── Helpers ──────────────────────────────────────────────────────────

def _build_context_block(chunks: list[str]) -> str:
    """Join context chunks with delimiters for the LLM prompt."""
    return "\n---\n".join(chunks) if chunks else ""


def _build_messages(
    system_prompt: str,
    context_block: str,
    question: str,
) -> list[dict[str, str]]:
    """Construct [system, user] message list with optional context."""
    user_content = (
        f"Context:\n{context_block}\n\nQuestion: {question}"
        if context_block
        else f"Question: {question}"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/ask")
async def ask_tutor(req: AskRequest) -> dict:
    """Answer a student's question using RAG + Groq LLM.

    Retrieves NCERT context from ChromaDB, and if found, grounds
    the answer in that context. Falls back to general tutor prompt
    when no context is available.
    """
    try:
        context_chunks = query_context(req.subject, req.question, n_results=5)
    except Exception:
        context_chunks = []

    context_block = _build_context_block(context_chunks)

    system_prompt = GROUNDED_SYSTEM_PROMPT if context_chunks else GENERAL_SYSTEM_PROMPT
    messages = _build_messages(system_prompt, context_block, req.question)

    try:
        answer: str = chat(messages, model=QUALITY_MODEL)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tutor AI failed: {e}")

    return {"answer": answer}


@router.post("/stream")
async def stream_tutor(req: StreamRequest) -> StreamingResponse:
    """Stream a tutor response as Server-Sent Events.

    Uses the strict NCERT-only system prompt to ensure the model
    does not hallucinate beyond the provided context.
    """
    try:
        context_chunks = query_context(req.subject, req.question, n_results=5)
    except Exception:
        context_chunks = []

    context_block = _build_context_block(context_chunks)
    messages = _build_messages(STREAMING_SYSTEM_PROMPT, context_block, req.question)

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


@router.post("/chat")
async def chat_tutor(req: ChatRequest) -> dict:
    """Multi-turn conversation with RAG context injection.

    Injects relevant NCERT context into the system message so that
    the model can ground its replies across the full conversation.
    """
    # Use the latest user message for context retrieval
    latest_user_msg = ""
    for msg in reversed(req.messages):
        if msg.role == "user":
            latest_user_msg = msg.content
            break

    try:
        context_chunks = query_context(req.subject, latest_user_msg, n_results=5) if latest_user_msg else []
    except Exception:
        context_chunks = []

    context_block = _build_context_block(context_chunks)

    system_prompt = GROUNDED_SYSTEM_PROMPT if context_chunks else GENERAL_SYSTEM_PROMPT
    if context_block:
        system_prompt += f"\n\nNCERT Context:\n{context_block}"

    # Build full message list with system message at the front
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend({"role": m.role, "content": m.content} for m in req.messages)

    try:
        reply: str = chat(messages, model=QUALITY_MODEL)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tutor chat failed: {e}")

    return {"reply": reply}
