# 🎓 Companio — AI Learning Companion

> Personalised AI study assistant for JEE / NEET / UPSC aspirants with spaced repetition, adaptive practice, RAG tutoring, micro-learning, and Hindi voice support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite, TailwindCSS |
| **Backend** | FastAPI (Python 3.11+) |
| **AI / LLM** | Groq (Llama 3.1 8B Instant + Llama 3.3 70B Versatile) |
| **Vector DB** | ChromaDB (local, persistent) |
| **Database** | Supabase (PostgreSQL + Auth + Realtime) |
| **Embeddings** | Sentence-Transformers (`all-MiniLM-L6-v2`) |

---

## Modules

| # | Module | Description |
|---|--------|-------------|
| M1 | **Spaced Repetition (SRS)** | SM-2 algorithm for optimal flashcard scheduling |
| M2 | **AI Study Planner** | Groq-powered daily study plans based on weak topics & exam dates |
| M3 | **Adaptive Practice** | PYQ-style MCQ generation with difficulty scaling |
| M4 | **RAG Tutor** | NCERT-grounded Q&A with ChromaDB context retrieval |
| M5 | **Micro-Time Mode** | 2/5/10-minute bite-sized sessions with flashcards + MCQs + formulas |
| ⭐ | **Hindi Voice Tutor** | Hinglish explanations optimised for text-to-speech |
| 🔄 | **Offline PWA** | Service worker caching for offline access |
| ⚡ | **Realtime Sync** | Supabase Realtime for cross-device state sync |

---

## Setup Instructions

### 1. Supabase — Create Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Cards (SRS flashcards)
CREATE TABLE cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  ease_factor FLOAT DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  next_review DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attempts (review logs)
CREATE TABLE attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id UUID REFERENCES cards(id),
  score INT NOT NULL,
  time_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily study plans
CREATE TABLE daily_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  plan JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, plan_date)
);

-- Micro sessions (streak tracking)
CREATE TABLE micro_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_date DATE NOT NULL,
  subject TEXT,
  minutes INT,
  items_completed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, session_date)
);

-- View for weak topic analytics
CREATE OR REPLACE VIEW topic_scores AS
SELECT
  a.user_id,
  c.topic,
  c.subject,
  ROUND(AVG(a.score)::numeric, 2) AS avg_score,
  COUNT(*) AS attempt_count
FROM attempts a
JOIN cards c ON a.card_id = c.id
GROUP BY a.user_id, c.topic, c.subject;
```

### 2. Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your keys:

```
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### 3. Backend — Install & Run

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py
```

Server starts at **http://localhost:8000** — Swagger docs at **/docs**.

### 4. NCERT Ingestion (optional, for RAG tutor)

```bash
python ingest/pdf_loader.py --subject physics --pdf ncert_physics_11.pdf
python ingest/pdf_loader.py --subject chemistry --pdf ncert_chem_11.pdf
```

### 5. Seed Demo Data

```bash
python ingest/seed_syllabus.py --user_id <your-uuid>
```

### 6. Frontend — Install & Run

```bash
cd frontend
npm install
npm run dev
```

App opens at **http://localhost:5173**.

---

## API Endpoints

### SRS (`/api/srs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/srs/due/{user_id}` | Fetch flashcards due for review today |
| POST | `/api/srs/review` | Submit review score, run SM-2, update card |
| POST | `/api/srs/cards` | Create a new flashcard |
| GET | `/api/srs/stats/{user_id}` | Aggregated study statistics |

### Planner (`/api/planner`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/planner/generate` | Generate AI daily study plan |
| GET | `/api/planner/{user_id}/today` | Get today's saved plan |

### Practice (`/api/practice`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/practice/generate` | Generate PYQ-style MCQs |
| POST | `/api/practice/submit` | Submit answer and log attempt |
| GET | `/api/practice/weak-areas/{user_id}` | Weakest topics by avg score |

### Tutor (`/api/tutor`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tutor/ask` | Single Q&A with NCERT RAG context |
| POST | `/api/tutor/stream` | Streaming SSE response |
| POST | `/api/tutor/chat` | Multi-turn conversation with RAG |
| POST | `/api/tutor/hindi` | Hindi / Hinglish voice-friendly answer |
| POST | `/api/tutor/hindi/stream` | Hindi streaming SSE response |

### Micro-Time (`/api/microtime`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/microtime/session` | Generate 2/5/10-min micro session |
| GET | `/api/microtime/streak/{user_id}` | Daily study streak count |
| POST | `/api/microtime/log` | Log completed micro session |

---

## Project Structure

```
companio/
├── backend/
│   ├── main.py                  # FastAPI app + router registration
│   ├── requirements.txt
│   ├── .env.example
│   ├── services/
│   │   ├── ai_service.py        # Groq LLM + ChromaDB vector store
│   │   ├── supabase_service.py  # Supabase persistence layer
│   │   └── srs_engine.py        # SM-2 spaced repetition algorithm
│   ├── routers/
│   │   ├── srs.py               # SRS endpoints
│   │   ├── planner.py           # Study planner endpoints
│   │   ├── practice.py          # MCQ generation + submission
│   │   ├── tutor.py             # RAG tutor (ask / stream / chat)
│   │   ├── microtime.py         # Micro-time sessions + streaks
│   │   └── hindi_tutor.py       # Hindi voice tutor
│   ├── ingest/
│   │   ├── pdf_loader.py        # NCERT PDF → ChromaDB ingestion
│   │   └── seed_syllabus.py     # Demo card seeder
│   └── chroma_db/               # Persistent vector store (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## Team

| Role | Responsibility |
|------|---------------|
| **Teammate 1** | Backend + AI (FastAPI, Groq, ChromaDB, SRS engine) |
| **Teammate 2** | Data + Innovation (NCERT ingestion, Micro-Time, Hindi Voice) |
| **Teammate 3** | Frontend + Demo (React UI, PWA, Realtime, presentation) |

---

**Built for DevClash 2026 @ NIT Raipur** 🚀
