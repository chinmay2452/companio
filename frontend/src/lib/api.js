import axios from "axios";

// Change this to your teammate's backend URL when they share it
const BASE = "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Study Planner ──────────────────────────────────────────────────
export const generatePlan = (userId) =>
  api.post("/api/planner/generate", { user_id: userId });

export const getTodayPlan = (userId) =>
  api.get(`/api/planner/${userId}/today`);

// ── Practice / MCQ ────────────────────────────────────────────────
export const generateQuestions = (subject, topic, difficulty) =>
  api.post("/api/practice/generate", { subject, topic, difficulty });

export const submitAnswer = (userId, questionId, correct, timeSec) =>
  api.post("/api/practice/submit", {
    user_id: userId,
    question_id: questionId,
    correct,
    time_seconds: timeSec,
  });

export const getWeakAreas = (userId) =>
  api.get(`/api/practice/weak-areas/${userId}`);

// ── SRS Revisions ─────────────────────────────────────────────────
export const getDueCards = (userId) =>
  api.get(`/api/srs/due/${userId}`);

export const reviewCard = (userId, cardId, quality) =>
  api.post("/api/srs/review", { user_id: userId, card_id: cardId, quality });

export const getSrsStats = (userId) =>
  api.get(`/api/srs/stats/${userId}`);

// ── AI Tutor ──────────────────────────────────────────────────────
export const askTutorHindi = (question, history = []) =>
  api.post("/api/tutor/hindi", { question, history });

// ── Micro-Time ────────────────────────────────────────────────────
export const getMicroSession = (userId, minutes) =>
  api.post("/api/microtime/session", { user_id: userId, minutes });

// Demo user ID — replace with real Supabase auth later
export const DEMO_USER = "demo-user-001";