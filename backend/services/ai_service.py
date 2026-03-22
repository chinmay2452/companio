"""
AI Service — Groq LLM + ChromaDB vector store.

Provides thin wrappers around the Groq chat API and a ChromaDB-backed
retrieval layer used for RAG across every feature module.
"""

from __future__ import annotations

import os
from typing import Generator

from dotenv import load_dotenv
from groq import Groq
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

load_dotenv()

# ── Groq client ──────────────────────────────────────────────────────
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")
groq_client: Groq = Groq(api_key=GROQ_API_KEY)

# Model aliases
FAST_MODEL: str = "llama-3.1-8b-instant"          # MCQ gen, planner — high volume
QUALITY_MODEL: str = "llama-3.3-70b-versatile"    # RAG tutor, Hindi — best quality

# ── ChromaDB setup ───────────────────────────────────────────────────
chroma_client: chromadb.ClientAPI = chromadb.PersistentClient(path="./chroma_db")

embedding_fn: SentenceTransformerEmbeddingFunction = (
    SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
)


# ── LLM helpers ──────────────────────────────────────────────────────
def chat(
    messages: list[dict[str, str]],
    model: str = FAST_MODEL,
    stream: bool = False,
    max_tokens: int = 1024,
) -> str:
    """Send a chat-completion request and return the assistant message.

    Args:
        messages: OpenAI-style list of role/content dicts.
        model: Groq model identifier.
        stream: Whether to use streaming (ignored here; use ``stream_chat``).
        max_tokens: Maximum tokens in the response.

    Returns:
        The text content of the assistant's reply.
    """
    response = groq_client.chat.completions.create(
        model=model,
        messages=messages,
        stream=False,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def stream_chat(
    messages: list[dict[str, str]],
    model: str = QUALITY_MODEL,
) -> Generator[str, None, None]:
    """Stream a chat-completion and yield text chunks as they arrive.

    Args:
        messages: OpenAI-style list of role/content dicts.
        model: Groq model identifier.

    Yields:
        Successive text fragments from the model response.
    """
    response = groq_client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


# ── Vector-store helpers ─────────────────────────────────────────────
def get_collection(subject: str) -> chromadb.Collection:
    """Return (or create) a ChromaDB collection for the given subject.

    Args:
        subject: Subject name used as the collection identifier
                 (e.g. ``"physics"``, ``"biology"``).

    Returns:
        A ChromaDB ``Collection`` backed by the shared embedding function.
    """
    return chroma_client.get_or_create_collection(
        name=subject,
        embedding_function=embedding_fn,
    )


def query_context(
    subject: str,
    question: str,
    n_results: int = 5,
) -> list[str]:
    """Retrieve the top-k document chunks most relevant to *question*.

    Args:
        subject: The subject collection to search in.
        question: The user query to embed and match against.
        n_results: Number of chunks to return.

    Returns:
        A list of document-chunk strings ordered by relevance.
    """
    collection = get_collection(subject)
    results = collection.query(
        query_texts=[question],
        n_results=n_results,
    )
    # results["documents"] is a list of lists; flatten the first query
    return results["documents"][0] if results["documents"] else []


def generate_mcq(topic: str, difficulty: str = "medium") -> dict:
    """Generate a single MCQ on the given topic using the FAST_MODEL.

    Returns a dict with keys: question, options, correct_index.
    """
    import json
    import re

    messages = [
        {
            "role": "system",
            "content": (
                "You are a JEE/NEET question paper setter. "
                "Generate exactly 1 MCQ. Return ONLY valid JSON with keys: "
                "question (str), options (array of 4 strings), correct_index (int 0-3). "
                "No markdown, no explanation."
            ),
        },
        {
            "role": "user",
            "content": f"Generate 1 {difficulty}-level MCQ on '{topic}'.",
        },
    ]

    try:
        raw = chat(messages, model=FAST_MODEL, max_tokens=512)
        raw = raw.strip()
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
        return json.loads(raw.strip())
    except Exception:
        return {
            "question": f"What is a key concept in {topic}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
        }

def generate_formula(topic: str, subject: str) -> dict:
    """Generate a single formula or fact on the given topic using the FAST_MODEL.

    Returns a dict with keys: formula_text, explanation.
    """
    import json
    import re

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert tutor preparing quick revision notes. "
                "Generate exactly 1 key formula, fact, or core concept to memorize. "
                "Return ONLY valid JSON with keys: 'formula_text' (the formula or short fact), "
                "and 'explanation' (brief clear explanation of terms or the concept). "
                "No markdown outside JSON."
            ),
        },
        {
            "role": "user",
            "content": f"Generate 1 key item to memorize for {subject} - {topic}.",
        },
    ]

    try:
        raw = chat(messages, model=FAST_MODEL, max_tokens=512)
        raw = raw.strip()
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
        return json.loads(raw.strip())
    except Exception:
        return {
            "formula_text": f"Crucial concept in {topic}",
            "explanation": f"Make sure to review {topic} thoroughly.",
        }


def extract_concept(
    question: str,
    correct_answer: str,
    subject: str,
    topic: str,
) -> dict:
    """Extract the core concept from a wrong-answered question and generate a flashcard.

    Returns a dict with keys: concept, formula, front, back.
    Uses FAST_MODEL for speed since this runs on every wrong answer.
    """
    import json

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert education analyst. A student answered a question incorrectly. "
                "Extract the core concept they need to revise and generate a flashcard.\n"
                "Return ONLY valid JSON with these keys:\n"
                '- "concept": short concept name (e.g. "Kinetic Energy")\n'
                '- "formula": key formula if applicable, or empty string (e.g. "KE = ½mv²")\n'
                '- "front": flashcard question (concise, e.g. "What is the formula for Kinetic Energy?")\n'
                '- "back": flashcard answer with explanation (e.g. "KE = ½mv², where m = mass in kg, v = velocity in m/s")\n'
                "No markdown. No extra text. ONLY the JSON object."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Subject: {subject}\n"
                f"Topic: {topic}\n"
                f"Question: {question}\n"
                f"Correct Answer: {correct_answer}\n"
                "Extract the core concept and generate a revision flashcard."
            ),
        },
    ]

    try:
        raw = chat(messages, model=FAST_MODEL, max_tokens=300)
        raw = raw.strip()
        # Find JSON boundaries
        start = -1
        end = -1
        for i, c in enumerate(raw):
            if c == '{':
                start = i
                break
        for i in range(len(raw) - 1, -1, -1):
            if raw[i] == '}':
                end = i
                break
        if start != -1 and end != -1:
            return json.loads(raw[start:end + 1])
    except Exception:
        pass

    # Fallback if AI fails
    return {
        "concept": topic,
        "formula": "",
        "front": f"What is a key concept in {topic} ({subject})?",
        "back": f"Review the fundamentals of {topic} in {subject}. Correct answer was: {correct_answer}",
    }
