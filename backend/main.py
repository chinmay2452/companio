"""
AI Learning Companion — FastAPI Backend
DevClash 2026 @ NIT Raipur

Main application entry point with CORS middleware and router registration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Router imports ───────────────────────────────────────────────────
from routers import srs, planner, practice, tutor, microtime, hindi_tutor

# ── App initialisation ──────────────────────────────────────────────
app = FastAPI(
    title="AI Learning Companion",
    description="Personalised AI study assistant for JEE / NEET / UPSC aspirants",
    version="0.1.0",
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────────
app.include_router(srs.router,          prefix="/api/srs",          tags=["SRS"])
app.include_router(planner.router,      prefix="/api/planner",      tags=["Planner"])
app.include_router(practice.router,     prefix="/api/practice",     tags=["Practice"])
app.include_router(tutor.router,        prefix="/api/tutor",        tags=["Tutor"])
app.include_router(microtime.router,    prefix="/api/microtime",    tags=["Microtime"])
app.include_router(hindi_tutor.router,  prefix="/api/hindi_tutor",  tags=["Hindi Tutor"])

# ── Root health-check ───────────────────────────────────────────────
FEATURES = [
    "Spaced Repetition System (SRS)",
    "AI Study Planner",
    "Adaptive Practice / MCQ Generator",
    "RAG-Powered Tutor",
    "Micro-Time Optimiser",
    "Hindi-Medium Tutor",
]


@app.get("/")
async def root() -> dict:
    """Health-check endpoint that lists every registered feature."""
    return {
        "status": "running",
        "project": "AI Learning Companion",
        "hackathon": "DevClash 2026 — NIT Raipur",
        "features": FEATURES,
    }


# ── Dev entry point ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
