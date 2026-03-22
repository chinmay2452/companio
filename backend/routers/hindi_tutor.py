"""
Hindi Tutor Router — Hindi-medium AI explanations.

Provides tutor functionality in Hindi for students who prefer
vernacular-medium instruction, using RAG + the high-quality model.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_service import chat, stream_chat, query_context, QUALITY_MODEL

router = APIRouter()


class HindiQuery(BaseModel):
    """Payload for asking the Hindi tutor a question."""

    subject: str
    question: str
    stream: bool = False


@router.post("/ask")
async def ask_hindi_tutor(req: HindiQuery) -> dict | StreamingResponse:
    """Answer a student's question in Hindi using RAG + Groq LLM."""
    context_chunks: list[str] = query_context(req.subject, req.question)
    context_block: str = "\n---\n".join(context_chunks) if context_chunks else ""

    messages = [
        {
            "role": "system",
            "content": (
                "आप एक विशेषज्ञ ट्यूटर हैं। कृपया हिंदी में स्पष्ट और "
                "चरण-दर-चरण उत्तर दें। दिए गए संदर्भ का उपयोग करें। "
                "यदि संदर्भ अपर्याप्त है, तो अपने ज्ञान से उत्तर दें "
                "लेकिन स्पष्ट रूप से बताएं।"
            ),
        },
        {
            "role": "user",
            "content": (
                f"संदर्भ:\n{context_block}\n\n"
                f"प्रश्न: {req.question}"
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
