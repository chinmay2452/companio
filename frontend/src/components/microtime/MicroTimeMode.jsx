import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useIsOnline } from '../../store/useAppStore';
import { api } from '../../lib/api';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';

/* ── Design tokens ──────────────────────────────────────────────── */
const C = {
  bg:         "#060e1f",
  surface:    "#0f192e",
  surfaceHi:  "#151f36",
  surfaceTop: "#1a253e",
  primary:    "#aba3ff",
  primaryDim: "#6d5fef",
  secondary:  "#23eea8",
  tertiary:   "#ffdb8f",
  error:      "#ff6e84",
  textPrimary:"#dee5fd",
  textMuted:  "#a3abc1",
  outline:    "#40485b",
};
const glass = (extra = {}) => ({
  background: "rgba(15,25,46,0.85)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid rgba(64,72,91,0.3)`,
  borderRadius: 14,
  ...extra,
});

const SCREENS = { PICKER: 1, ACTIVE: 2, RESULTS: 3, LOADING: 4, EQUATIONS: 5 };

/* ── Duration options ───────────────────────────────────────────── */
const DURATIONS = [
  { min: 2,  emoji: "⚡", desc: "Quick burst",   badge: "Fast",         badgeColor: C.textMuted },
  { min: 5,  emoji: "🎯", desc: "Focused",        badge: "Popular",     badgeColor: C.secondary, popular: true },
  { min: 10, emoji: "🏆", desc: "Power session",  badge: "Recommended", badgeColor: C.tertiary,  recommended: true },
];

/* ── Stat chip ─────────────────────────────────────────────────── */
function StatChip({ icon, label, value, glow }) {
  return (
    <div style={{ ...glass({ padding: "12px 16px", flex: 1 }), boxShadow: `0 0 18px ${glow}18`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 40, height: 40, borderRadius: "50%", background: glow, opacity: 0.1, filter: "blur(14px)" }} />
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: glow, fontFamily: "Manrope,sans-serif" }}>{value}</div>
    </div>
  );
}

/* ── Duration card ──────────────────────────────────────────────── */
function DurCard({ opt, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected === opt.min;
  return (
    <div
      onClick={() => onSelect(opt.min)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", padding: "22px 16px", borderRadius: 14, cursor: "pointer",
        textAlign: "center", transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        background: isActive ? `linear-gradient(135deg,${C.primaryDim}22,${C.primary}10)` : hovered ? C.surfaceHi : C.surface,
        border: isActive ? `1px solid ${C.primary}77` : hovered ? `1px solid ${C.outline}88` : `1px solid ${C.outline}33`,
        boxShadow: isActive ? `0 0 28px ${C.primary}28` : hovered ? `0 6px 20px rgba(0,0,0,0.35)` : "none",
        transform: hovered && !isActive ? "translateY(-4px)" : "none",
      }}
    >
      {/* Badge */}
      {opt.recommended && (
        <div style={{
          position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
          fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
          background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          border: `1px solid ${C.primary}55`, borderRadius: "0 0 8px 8px", padding: "1px 10px",
        }}>⚡ Recommended</div>
      )}
      <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 700, color: opt.badgeColor, background: `${opt.badgeColor}18`, border: `1px solid ${opt.badgeColor}33`, borderRadius: 10, padding: "2px 7px" }}>{opt.badge}</div>

      <div style={{ fontSize: 32, fontWeight: 800, color: isActive ? C.primary : C.textPrimary, fontFamily: "Manrope,sans-serif", letterSpacing: -1, marginTop: opt.recommended ? 10 : 0, marginBottom: 2, transition: "color 0.2s" }}>
        {opt.min}
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>min</div>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.emoji}</div>
      <div style={{ fontSize: 11, color: hovered || isActive ? C.textPrimary : C.textMuted, fontWeight: 500, transition: "color 0.2s" }}>{opt.desc}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function MicroTimeMode() {
  const user = useUser();
  const isOnline = useIsOnline();
  const { data: storeData } = useRealtimeStore();

  const [screen,           setScreen]           = useState(SCREENS.PICKER);
  const [duration,         setDuration]         = useState(5);
  const [subject,          setSubject]          = useState('All');
  const [topic,            setTopic]            = useState('All');
  const [sessionId,        setSessionId]        = useState('');
  const [items,            setItems]            = useState([]);
  const [currentIndex,     setCurrentIndex]     = useState(0);
  const [results,          setResults]          = useState([]);
  const [timeLeft,         setTimeLeft]         = useState(0);
  const [itemStartTime,    setItemStartTime]    = useState(Date.now());
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [mcqAnswered,      setMcqAnswered]      = useState(null);
  const [finalStats,       setFinalStats]       = useState(null);
  const [sessionsToday,    setSessionsToday]    = useState(2);
  const [studyMode,        setStudyMode]        = useState('quiz'); // 'quiz' or 'equations'
  const [generatedEquations, setGeneratedEquations] = useState([]);
  const timerRef = useRef(null);

  // Live Analytics from Postgres
  const stats = useMemo(() => {
    const list = storeData.micro_sessions || [];
    let sessionsToday = 0;
    let totalMins = 0;
    let accSum = 0;
    let validAccSessions = 0;
    const today = new Date().toISOString().split('T')[0];
    
    list.forEach(s => {
      const dbDate = (s.created_at || s.completed_at || '').split('T')[0];
      if (dbDate === today) sessionsToday++;
      
      if (s.completed) {
        totalMins += (s.duration_minutes || 0);
        if (s.total_items > 0) {
          accSum += (s.correct_count / s.total_items) * 100;
          validAccSessions++;
        }
      }
    });

    // We can also fetch streak directly from the store if we have a table, but for now fallback to the session's prop or 0
    return {
      streak: list.length > 0 ? (list[0].streak || 0) : 0,
      today: sessionsToday,
      totalMins: Math.round(totalMins),
      avgAcc: validAccSessions > 0 ? Math.round(accSum / validAccSessions) : 0,
    };
  }, [storeData]);

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };

  const startSession = async () => {
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";
    setScreen(SCREENS.LOADING);
    try {
      const res = await api.post('/api/microtime/session/start', {
        user_id: userId, duration_minutes: duration,
        subject: subject === 'All' ? null : subject,
        topic: topic === 'All' ? null : topic,
      });
      const data = res.data;
      setSessionId(data.session_id);
      setItems(data.content || []);
      setCurrentIndex(0); setResults([]); setFlashcardFlipped(false); setMcqAnswered(null);
      const totalSeconds = duration * 60;
      setTimeLeft(totalSeconds); setItemStartTime(Date.now());
      setScreen(SCREENS.ACTIVE);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { stopTimer(); handleSessionEnd(data.session_id, []); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      alert(isOnline ? 'Error starting session. Please try again.' : 'Network error. Try again when online.');
      setScreen(SCREENS.PICKER);
    }
  };

  const startEquations = async () => {
    setScreen(SCREENS.LOADING);
    try {
      const res = await api.post('/api/microtime/generate_equations', {
        subject: subject === 'All' ? 'General' : subject,
        topic: topic === 'All' ? 'Key Concepts' : topic,
        count: 6
      });
      setGeneratedEquations(res.data.equations || []);
      setScreen(SCREENS.EQUATIONS);
    } catch (err) {
      console.error(err);
      alert('Failed to generate equations. Try again.');
      setScreen(SCREENS.PICKER);
    }
  };

  const handleSessionEnd = async (activeSessionId = sessionId, forceResults = results) => {
    stopTimer();
    setScreen(SCREENS.LOADING);
    const fallbackStats = {
      streak: stats.streak,
      accuracy: forceResults.length ? (forceResults.filter(r => r.correct).length / forceResults.length) * 100 : 0,
      oldResults: forceResults,
    };
    try {
      const res = await api.post('/api/microtime/session/complete', {
        session_id: activeSessionId, user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        items_result: forceResults,
      });
      setFinalStats({ ...res.data, oldResults: forceResults });
    } catch {
      setFinalStats(fallbackStats);
    }
    setScreen(SCREENS.RESULTS);
  };

  useEffect(() => () => stopTimer(), []);

  const handleNextItem = (correct, forceResults = results) => {
    const currentItem = items[currentIndex];
    const timeSpent = (Date.now() - itemStartTime) / 1000;
    const newResult = { type: currentItem.type, card_id: currentItem.card_id || undefined, correct, time_seconds: timeSpent, subject: currentItem.subject, topic: currentItem.topic };
    const updatedResults = [...forceResults, newResult];
    setResults(updatedResults);
    if (currentIndex + 1 >= items.length) { handleSessionEnd(sessionId, updatedResults); }
    else { setCurrentIndex(p => p + 1); setItemStartTime(Date.now()); setFlashcardFlipped(false); setMcqAnswered(null); }
  };

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const progressPct = items.length > 0 ? Math.round((currentIndex / items.length) * 100) : 0;

  /* ── SCREEN: LOADING ─────────────────────────────────────────── */
  if (screen === SCREENS.LOADING) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, fontFamily: "Inter,sans-serif", color: C.textPrimary }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: `3px solid ${C.outline}`, borderTopColor: C.primary, animation: "spin 0.9s linear infinite", marginBottom: 16 }} />
          <p style={{ color: C.textMuted, fontWeight: 600, fontSize: 13 }}>Preparing your session…</p>
        </div>
      </>
    );
  }

  /* ── SCREEN: RESULTS ─────────────────────────────────────────── */
  if (screen === SCREENS.RESULTS) {
    const acc    = finalStats?.accuracy ?? 0;
    const streak = finalStats?.streak ?? stats.streak;
    let msg = "Tough session. Revision scheduled automatically ✓";
    if (acc >= 80) msg = "Excellent! Keep the streak alive 🚀";
    else if (acc >= 50) msg = "Good effort. Review the missed ones 💪";
    if (finalStats?.message) msg = finalStats.message;
    const summarize = finalStats?.oldResults || [];
    const totalCards = summarize.filter(r => r.type === 'flashcard').length;
    const totalMcqs  = summarize.filter(r => r.type === 'mcq').length;

    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');@keyframes fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
        <div style={{ padding: "28px", display: "flex", justifyContent: "center", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>
          <div style={{ ...glass({ padding: "44px 40px", textAlign: "center", maxWidth: 420, width: "100%" }), border: `1px solid ${C.secondary}44`, animation: "fade-in 0.4s ease" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🏆</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.secondary, fontFamily: "Manrope,sans-serif", margin: "0 0 12px" }}>Session Complete!</h2>
            <div style={{ fontSize: 52, fontWeight: 800, color: C.primary, fontFamily: "Manrope,sans-serif", letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{Math.round(acc)}%</div>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 20 }}>Accuracy</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${C.tertiary}18`, border: `1px solid ${C.tertiary}44`, borderRadius: 24, padding: "8px 20px", marginBottom: 20 }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.tertiary, fontFamily: "Manrope,sans-serif" }}>{streak} Day Streak!</span>
            </div>
            <div style={{ ...glass({ padding: "14px 18px", marginBottom: 20 }), border: `1px solid ${C.primary}22` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, lineHeight: 1.5 }}>{msg}</div>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
              {[{ label: "Flashcards", val: totalCards, col: C.primary }, { label: "MCQs", val: totalMcqs, col: C.secondary }].map((r, i) => (
                <div key={i} style={{ ...glass({ padding: "12px 20px" }) }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: r.col, fontFamily: "Manrope,sans-serif" }}>{r.val}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>{r.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setScreen(SCREENS.PICKER)}
              style={{ width: "100%", background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope,sans-serif", boxShadow: `0 4px 20px ${C.primary}44` }}
            >⚡ Study Again</button>
          </div>
        </div>
      </>
    );
  }

  /* ── SCREEN: ACTIVE SESSION ──────────────────────────────────── */
  if (screen === SCREENS.ACTIVE) {
    const currentItem = items[currentIndex];
    const isLow = timeLeft < 30;
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes pulse-red{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 20px", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>

          {!isOnline && (
            <div style={{ background: `${C.tertiary}18`, border: `1px solid ${C.tertiary}44`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: C.tertiary, textAlign: "center", marginBottom: 12, fontWeight: 600 }}>
              ⚠️ Offline — session will sync on reconnect
            </div>
          )}

          {/* Timer card */}
          <div style={{ ...glass({ padding: "16px 20px", marginBottom: 16 }) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 22, fontWeight: 800, fontFamily: "Manrope,sans-serif", letterSpacing: -1,
                  color: isLow ? C.error : C.secondary,
                  animation: isLow ? "pulse-red 0.8s ease-in-out infinite" : "none",
                }}>
                  {formatTime(timeLeft)}
                </span>
                <span style={{ fontSize: 11, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6, fontWeight: 700 }}>
                  {currentIndex + 1} / {items.length}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.tertiary}18`, border: `1px solid ${C.tertiary}33`, borderRadius: 20, padding: "4px 12px" }}>
                <span style={{ fontSize: 13 }}>🔥</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.tertiary }}>{stats.streak} Streak</span>
              </div>
            </div>
            <div style={{ height: 6, background: C.surfaceTop, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, borderRadius: 3, transition: "width 0.5s ease", background: `linear-gradient(90deg,${C.primaryDim},${C.primary},${C.secondary})`, boxShadow: `0 0 8px ${C.primary}66` }} />
            </div>
          </div>

          {/* Flashcard */}
          {currentItem?.type === 'flashcard' && (
            <div style={{ animation: "fade-in 0.3s ease" }}>
              <div
                onClick={() => !flashcardFlipped && setFlashcardFlipped(true)}
                style={{
                  ...glass({ padding: "44px 32px", textAlign: "center", cursor: "pointer", minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 12, transition: "all 0.3s" }),
                  border: flashcardFlipped ? `1px solid ${C.primary}55` : `1px solid ${C.outline}33`,
                  boxShadow: flashcardFlipped ? `0 0 28px ${C.primary}18` : "none",
                  background: flashcardFlipped ? `linear-gradient(135deg,${C.primaryDim}08,${C.primary}04)` : "rgba(15,25,46,0.85)",
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>
                  {flashcardFlipped ? "Answer — tap to flip back" : "Question — tap to reveal"}
                </div>
                <div style={{ fontSize: 11, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6, marginBottom: 16, fontWeight: 700 }}>{currentItem.topic}</div>
                <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.6, color: flashcardFlipped ? C.primary : C.textPrimary }}>
                  {flashcardFlipped ? currentItem.back : currentItem.front}
                </div>
                {!flashcardFlipped && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 16 }}>↓ Tap to reveal</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleNextItem(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.outline}33`, borderRadius: 10, padding: "10px", fontSize: 12, color: C.textMuted, cursor: "pointer" }}>Skip</button>
                {flashcardFlipped && (
                  <>
                    <button onClick={() => handleNextItem(false)} style={{ flex: 1, background: `${C.error}18`, color: C.error, border: `1px solid ${C.error}33`, borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✗ Missed</button>
                    <button onClick={() => handleNextItem(true)}  style={{ flex: 1, background: `linear-gradient(135deg,${C.secondary}cc,#1cc693)`, color: "#031a12", border: "none", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>✓ Got it</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* MCQ */}
          {currentItem?.type === 'mcq' && (
            <div style={{ animation: "fade-in 0.3s ease" }}>
              <div style={{ ...glass({ padding: "22px 20px", marginBottom: 12 }) }}>
                <div style={{ fontSize: 11, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6, marginBottom: 12, fontWeight: 700, display: "inline-block" }}>{currentItem.topic}</div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: C.textPrimary, marginBottom: 16 }}>{currentItem.question}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentItem.options.map((opt, idx) => {
                    let bg = C.surfaceTop, border = `1px solid ${C.outline}33`, color = C.textPrimary;
                    if (mcqAnswered !== null) {
                      if (idx === currentItem.correct_index) { bg = `${C.secondary}12`; border = `1px solid ${C.secondary}55`; color = C.secondary; }
                      else if (idx === mcqAnswered)           { bg = `${C.error}12`;    border = `1px solid ${C.error}55`;    color = C.error; }
                      else                                    { color = C.textMuted; }
                    }
                    return (
                      <button key={idx} disabled={mcqAnswered !== null} onClick={() => setMcqAnswered(idx)}
                        style={{ textAlign: "left", padding: "11px 14px", borderRadius: 9, border, background: bg, color, cursor: mcqAnswered !== null ? "default" : "pointer", fontSize: 13, transition: "all 0.2s", fontFamily: "inherit", display: "flex", gap: 10, alignItems: "center" }}
                      >
                        <span style={{ fontWeight: 800, color: "inherit", fontFamily: "monospace", opacity: 0.7 }}>{String.fromCharCode(65 + idx)}.</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {mcqAnswered !== null && currentItem.explanation && (
                  <div style={{ marginTop: 14, ...glass({ padding: "12px 14px" }), border: `1px solid ${C.primary}22`, animation: "fade-in 0.2s ease" }}>
                    <span style={{ fontSize: 10, color: C.primary, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Explanation: </span>
                    <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{currentItem.explanation}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleNextItem(false)} style={{ background: "transparent", border: `1px solid ${C.outline}33`, borderRadius: 10, padding: "10px 16px", fontSize: 12, color: C.textMuted, cursor: "pointer" }}>Skip</button>
                {mcqAnswered !== null && (
                  <button onClick={() => handleNextItem(mcqAnswered === currentItem.correct_index)}
                    style={{ flex: 1, background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Formula */}
          {currentItem?.type === 'formula' && (
            <div style={{ animation: "fade-in 0.3s ease" }}>
              <div style={{ ...glass({ padding: "28px 24px", textAlign: "center", marginBottom: 12 }) }}>
                <div style={{ fontSize: 11, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6, marginBottom: 20, fontWeight: 700, display: "inline-block" }}>{currentItem.topic}</div>
                <div style={{ background: C.surfaceTop, borderRadius: 12, padding: "22px 20px", fontFamily: "monospace", fontSize: 22, color: C.secondary, letterSpacing: 1, marginBottom: 18, boxShadow: `inset 0 0 20px rgba(0,0,0,0.3)`, border: `1px solid ${C.secondary}33` }}>
                  {currentItem.formula_text}
                </div>
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{currentItem.explanation}</p>
              </div>
              <button onClick={() => handleNextItem(true)} style={{ width: "100%", background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Got it ✓
              </button>
            </div>
          )}

          {/* End session */}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={() => handleSessionEnd()} style={{ background: "none", border: `1px solid ${C.error}33`, color: C.error, borderRadius: 8, padding: "7px 18px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              End Session
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ── SCREEN: EQUATIONS CHEAT SHEET ───────────────────────────── */
  if (screen === SCREENS.EQUATIONS) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 20px", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0, color: C.primary }}>
                📝 Quick Notes
              </h1>
              <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>
                High-yield concepts for {subject} {topic !== 'All' ? `— ${topic}` : ''}
              </p>
            </div>
            <button onClick={() => setScreen(SCREENS.PICKER)} style={{ background: C.surfaceTop, border: `1px solid ${C.outline}33`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: C.textMuted, cursor: "pointer" }}>
              ← Back
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {generatedEquations.map((eq, idx) => (
              <div key={idx} style={{ ...glass({ padding: "20px" }), animation: `fade-in 0.4s ease ${idx * 0.1}s backwards` }}>
                <div style={{ fontSize: 11, color: C.tertiary, background: `${C.tertiary}14`, border: `1px solid ${C.tertiary}33`, padding: "3px 10px", borderRadius: 6, marginBottom: 14, fontWeight: 700, display: "inline-block" }}>
                  Concept #{idx + 1}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: C.textPrimary }}>
                  {eq.concept}
                </h3>
                {eq.formula && (
                  <div style={{ background: `linear-gradient(135deg, ${C.bg}, ${C.surface})`, borderRadius: 8, padding: "16px", fontFamily: "monospace", fontSize: 18, color: C.secondary, letterSpacing: 1, marginBottom: 14, border: `1px solid ${C.outline}22`, textAlign: "center", boxShadow: "inset 0 4px 10px rgba(0,0,0,0.2)" }}>
                    {eq.formula}
                  </div>
                )}
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
                  {eq.explanation}
                </p>
              </div>
            ))}
          </div>
          
          <button onClick={() => setScreen(SCREENS.PICKER)} style={{ width: "100%", marginTop: 24, background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Manrope,sans-serif", boxShadow: `0 4px 20px ${C.primary}44` }}>
            ✓ Finish Review
          </button>
        </div>
      </>
    );
  }

  /* ── SCREEN: PICKER ──────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes card-in  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes fade-in   { from{opacity:0;transform:translateY(6px)}  to{opacity:1;transform:none} }
        @keyframes lightning { 0%,100%{opacity:.7} 50%{opacity:1} }
        .cta-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
        .live-badge { display: inline-flex; alignItems: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${C.secondary}; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; background: ${C.secondary}15; border-radius: 12px; border: 1px solid ${C.secondary}33; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
      <div style={{ padding: "24px 28px", fontFamily: "Inter,sans-serif", color: C.textPrimary, maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0 }}>⚡ Micro Learn</h1>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "5px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
              High-impact study sessions for when time is short
              <span className="live-badge"><span style={{width:6, height:6, borderRadius:"50%", background:C.secondary, animation: "pulse-dot 1.5s infinite"}}/> Live Sync</span>
            </p>
          </div>
          <div style={{ ...glass({ padding: "8px 16px" }), display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 16, animation: "lightning 2s ease-in-out infinite" }}>🔥</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.tertiary, fontFamily: "Manrope,sans-serif" }}>{stats.streak} Day Streak</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>Keep it going</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ display: "flex", background: C.surfaceTop, borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <button onClick={() => setStudyMode('quiz')}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              background: studyMode === 'quiz' ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : "transparent",
              color: studyMode === 'quiz' ? "#fff" : C.textMuted,
              boxShadow: studyMode === 'quiz' ? `0 4px 12px ${C.primary}44` : "none"
            }}>
            ⏱ Time Trial
          </button>
          <button onClick={() => setStudyMode('equations')}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              background: studyMode === 'equations' ? `linear-gradient(135deg,${C.tertiary},${C.tertiary}cc)` : "transparent",
              color: studyMode === 'equations' ? "#332200" : C.textMuted,
              boxShadow: studyMode === 'equations' ? `0 4px 12px ${C.tertiary}44` : "none"
            }}>
            📝 Quick Notes
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <StatChip icon="🎯" label="Sessions Today" value={stats.today}  glow={C.secondary} />
          <StatChip icon="✅" label="Avg Accuracy"  value={`${stats.avgAcc}%`} glow={stats.avgAcc > 70 ? C.primary : C.tertiary}   />
          <StatChip icon="⏱️" label="Total Minutes" value={stats.totalMins} glow="#4a9eff"  />
        </div>

        {/* Inline config */}
        <div style={{ ...glass({ padding: "16px 18px", marginBottom: 20 }), display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Subject</div>
            <select value={subject} onChange={e => { setSubject(e.target.value); setTopic('All'); }}
              style={{ width: "100%", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, padding: "9px 12px", outline: "none", cursor: "pointer" }}>
              {['All', 'Physics', 'Chemistry', 'Biology', 'Maths'].map(s => <option key={s} value={s}>{s === 'All' ? '📌 All Subjects' : s}</option>)}
            </select>
          </div>
          {subject !== 'All' && (
            <div style={{ flex: 1.4 }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Chapter / Topic</div>
              <select value={topic} onChange={e => setTopic(e.target.value)}
                style={{ width: "100%", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, padding: "9px 12px", outline: "none", cursor: "pointer" }}>
                <option value="All">📑 All Chapters</option>
                {subject === 'Physics' && (<>
                  <option value="Ch 1: Kinematics (Formulas)">Ch 1: Kinematics (Formulas)</option>
                  <option value="Ch 2: Thermodynamics (Formulas)">Ch 2: Thermodynamics (Formulas)</option>
                  <option value="Ch 3: Electromagnetism">Ch 3: Electromagnetism</option>
                  <option value="Ch 4: Mechanics (Concepts)">Ch 4: Mechanics (Concepts)</option>
                  <option value="Ch 5: Optics (Diagrams)">Ch 5: Optics (Diagrams)</option>
                  <option value="Ch 6: Modern Physics">Ch 6: Modern Physics</option>
                </>)}
                {subject === 'Chemistry' && (<>
                  <option value="Ch 1: Chemical Bonding (Names)">Ch 1: Chemical Bonding</option>
                  <option value="Ch 2: Organic Chemistry (Reactions)">Ch 2: Organic Chemistry</option>
                  <option value="Ch 3: Periodicity (Exceptions)">Ch 3: Periodicity</option>
                  <option value="Ch 4: Coordination Compounds">Ch 4: Coordination Compounds</option>
                  <option value="Ch 5: Electrochemistry">Ch 5: Electrochemistry</option>
                  <option value="Ch 6: s-Block & p-Block">Ch 6: s-Block & p-Block</option>
                </>)}
                {subject === 'Maths' && (<>
                  <option value="Ch 1: Calculus (Formulas)">Ch 1: Calculus</option>
                  <option value="Ch 2: Coordinate Geometry (Formulas)">Ch 2: Coordinate Geometry</option>
                  <option value="Ch 3: Algebra">Ch 3: Algebra</option>
                  <option value="Ch 4: Trigonometry (Identities)">Ch 4: Trigonometry</option>
                  <option value="Ch 5: Matrices & Determinants">Ch 5: Matrices & Determinants</option>
                  <option value="Ch 6: Probability & Statistics">Ch 6: Probability</option>
                </>)}
                {subject === 'Biology' && (<>
                  <option value="Ch 1: Cell Biology (Facts)">Ch 1: Cell Biology</option>
                  <option value="Ch 2: Human Physiology">Ch 2: Human Physiology</option>
                  <option value="Ch 3: Genetics">Ch 3: Genetics</option>
                  <option value="Ch 4: Plant Physiology">Ch 4: Plant Physiology</option>
                  <option value="Ch 5: Ecology & Environment">Ch 5: Ecology</option>
                  <option value="Ch 6: Biotechnology">Ch 6: Biotechnology</option>
                </>)}
              </select>
            </div>
          )}
        </div>

        {/* Duration cards (Quiz mode only) */}
        {studyMode === 'quiz' && (
          <>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 12 }}>Choose Session Length</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
              {DURATIONS.map((opt, i) => (
                <DurCard key={opt.min} opt={opt} selected={duration} onSelect={setDuration} />
              ))}
            </div>
          </>
        )}

        {/* Start CTA */}
        <button
          className="cta-btn"
          onClick={studyMode === 'quiz' ? startSession : startEquations}
          style={{
            width: "100%", padding: "15px", borderRadius: 12, border: "none",
            background: studyMode === 'equations' ? `linear-gradient(135deg,${C.tertiary},${C.tertiary}dd)` : `linear-gradient(135deg,${C.primary},${C.primaryDim})`,
            color: studyMode === 'equations' ? "#221100" : "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
            fontFamily: "Manrope,sans-serif", letterSpacing: -0.3,
            boxShadow: studyMode === 'equations' ? `0 6px 28px ${C.tertiary}55` : `0 6px 28px ${C.primary}44`, transition: "all 0.2s",
          }}
        >
          {studyMode === 'quiz' ? `⚡ Start ${duration} min Session 🚀` : `📝 Generate Cheat Sheet 🚀`}
        </button>

        {/* Info strip */}
        <div style={{ ...glass({ padding: "14px 18px", marginTop: 16 }), display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 22 }}>💡</div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
            Students using Micro Mode during commutes retain 40% more. Even 2 minutes of spaced revision dramatically reduces the forgetting curve.
          </div>
        </div>
      </div>
    </>
  );
}
