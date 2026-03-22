"""
Tutor Router — RAG-powered AI tutor.

Retrieves relevant context from ChromaDB and generates detailed
explanations using the high-quality Groq model.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_service import chat, stream_chat, query_context, QUALITY_MODEL

router = APIRouter()


class TutorQuery(BaseModel):
    """Payload for asking the tutor a question."""

    subject: str
    question: str
    stream: bool = False


@router.post("/ask")
async def ask_tutor(req: TutorQuery) -> dict | StreamingResponse:
    """Answer a student's question using RAG + Groq LLM."""
    context_chunks: list[str] = query_context(req.subject, req.question)
    context_block: str = "\n---\n".join(context_chunks) if context_chunks else ""

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert tutor. Use the provided context to give "
                "a clear, step-by-step explanation. If the context is "
                "insufficient, rely on your own knowledge but say so."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Context:\n{context_block}\n\n"
                f"Question: {req.question}"
            ),
        },
    ]

    if req.stream:
        return StreamingResponse(
            stream_chat(messages, model=QUALITY_MODEL),
            media_type="text/event-stream",
        )

    answer: str = chat(messages, model=QUALITY_MODEL)
    return {"answer": answer, "sources_used": len(context_chunks)}
