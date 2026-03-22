import axios from "axios";

// Change this to your teammate's backend URL when they share it
const BASE = "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Study Planner ──────────────────────────────────────────────────
export const generatePlan = (userId, examType = "JEE", availableHours = 6, examDate = null, subjects = [], topicsFocus = "") =>
  api.post("/api/planner/generate", {
    user_id: userId,
    exam_type: examType,
    exam_date: examDate,
    available_hours: availableHours,
    subjects: subjects,
    topics_focus: topicsFocus,
  });

export const getTodayPlan = (userId) =>
  api.get(`/api/planner/${userId}/today`);

// ── Practice / MCQ ────────────────────────────────────────────────
export const generateQuestions = (subject, topic, difficulty) =>
  api.post("/api/practice/generate", { subject, topic, difficulty });

export const submitAnswer = (userId, questionId, question, userAnswer, correctAnswer, timeSec, subject, topic) =>
  api.post("/api/practice/submit", {
    user_id: userId,
    card_id: String(questionId),
    question,
    user_answer: userAnswer,
    correct_answer: correctAnswer,
    time_seconds: timeSec,
    subject: subject || "Unknown",
    topic: topic || "Unknown",
  });

export const getWeakAreas = (userId) =>
  api.get(`/api/practice/weak-areas/${userId}`);

// ── SRS Revisions ─────────────────────────────────────────────────
export const getDueCards = (userId) =>
  api.get(`/api/srs/due/${userId}`);

export const getAllCards = (userId) =>
  api.get(`/api/srs/cards/${userId}`);

export const createCard = (userId, subject, topic, front, back) =>
  api.post("/api/srs/cards", { user_id: userId, subject, topic, front, back });

export const deleteCard = (cardId) =>
  api.delete(`/api/srs/cards/${cardId}`);

export const clearAllData = (userId) =>
  api.delete(`/api/srs/cards/clear/${userId}`);

export const reviewCard = (userId, cardId, score) =>
  api.post("/api/srs/review", { user_id: userId, card_id: cardId, score });

export const getSrsStats = (userId) =>
  api.get(`/api/srs/stats/${userId}`);

// ── AI Tutor ──────────────────────────────────────────────────────
export const askTutorHindi = (question, history = [], subject = "General", userId = DEMO_USER) =>
  api.post("/api/tutor/hindi", { question, history, subject, user_id: userId });

// ── Micro-Time ────────────────────────────────────────────────────
export const getMicroSession = (userId, minutes) =>
  api.post("/api/microtime/session/start", { user_id: userId, duration_minutes: minutes });

// ── User Stats ────────────────────────────────────────────────────
export const getUserStats = (userId) =>
  api.get(`/api/srs/stats/${userId}`);

// User ID is now obtained from Supabase Auth session (useAppStore)
