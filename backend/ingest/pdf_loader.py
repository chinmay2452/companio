"""
NCERT PDF Ingestion — loads PDF textbooks into ChromaDB for RAG.

Chunks the PDF into overlapping windows of ~500 words each and upserts
them into a subject-specific ChromaDB collection so the RAG tutor can
retrieve relevant context at query time.

Usage:
    python ingest/pdf_loader.py --subject physics --pdf ncert_physics_11.pdf
    python ingest/pdf_loader.py --subject chemistry --pdf ncert_chem_11.pdf
"""

from __future__ import annotations

import argparse
import os
import sys

# Allow running from `backend/` or `backend/ingest/`
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import fitz  # PyMuPDF

from services.ai_service import get_collection


# ── Chunking ─────────────────────────────────────────────────────────

def chunk_pdf(
    pdf_path: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[dict]:
    """Split a PDF into overlapping text chunks.

    Args:
        pdf_path: Path to the PDF file.
        chunk_size: Target chunk size in **words**.
        overlap: Number of overlapping words between consecutive chunks.

    Returns:
        A list of ``{text, metadata}`` dicts ready for ChromaDB upsert.
    """
    doc = fitz.open(pdf_path)
    filename = os.path.basename(pdf_path)

    # Extract all text with page markers
    full_text_parts: list[str] = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if text:
            full_text_parts.append(f"[Page {page_num + 1}]\n{text}")
    doc.close()

    full_text = "\n\n".join(full_text_parts)
    words = full_text.split()

    # Create overlapping chunks
    chunks: list[dict] = []
    idx = 0
    chunk_index = 0
    step = chunk_size - overlap

    while idx < len(words):
        chunk_words = words[idx : idx + chunk_size]
        chunk_text = " ".join(chunk_words)

        # Skip very short chunks (< 100 characters)
        if len(chunk_text) >= 100:
            chunks.append(
                {
                    "text": chunk_text,
                    "metadata": {
                        "source": filename,
                        "chunk_index": chunk_index,
                    },
                }
            )
            chunk_index += 1

        idx += step

    return chunks


# ── Ingestion ────────────────────────────────────────────────────────

def ingest_pdf(subject: str, pdf_path: str) -> None:
    """Chunk a PDF and upsert all chunks into ChromaDB.

    Args:
        subject: Subject name used as the ChromaDB collection identifier
                 (e.g. ``"physics"``, ``"biology"``).
        pdf_path: Path to the PDF file.
    """
    if not os.path.exists(pdf_path):
        print(f"Error: file not found — {pdf_path}")
        sys.exit(1)

    print(f"Chunking '{pdf_path}' for subject '{subject}' ...")
    chunks = chunk_pdf(pdf_path)
    print(f"Created {len(chunks)} chunks.")

    if not chunks:
        print("No chunks to ingest. Is the PDF empty?")
        return

    collection = get_collection(subject)
    batch_size = 100

    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        end = start + len(batch)

        collection.upsert(
            documents=[c["text"] for c in batch],
            ids=[f"{subject}_chunk_{start + i}" for i in range(len(batch))],
            metadatas=[c["metadata"] for c in batch],
        )

        print(f"  Ingested chunks {start} to {end - 1}")

    print(f"Done! {len(chunks)} chunks loaded for '{subject}'.")


# ── CLI entry point ──────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Load NCERT PDFs into ChromaDB for RAG."
    )
    parser.add_argument(
        "--subject",
        required=True,
        help="Subject name (e.g. physics, chemistry, biology)",
    )
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the PDF file",
    )
    args = parser.parse_args()

    ingest_pdf(args.subject, args.pdf)
