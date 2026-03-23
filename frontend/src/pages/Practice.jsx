import React, { useState, useEffect, useRef, useMemo } from "react";
import { generateQuestions, submitAnswer } from "../lib/api";
import { useRealtimeStore } from "../hooks/useRealtimeStore";

/* ── Design tokens ─────────────────────────────────────────────── */
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
  background: "rgba(15, 25, 46, 0.85)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid rgba(64,72,91,0.3)`,
  borderRadius: 14,
  ...extra,
});

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

/* ── Skeleton shimmer ──────────────────────────────────────────── */
function Sk({ w = "100%", h = 18, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg,${C.surface} 25%,${C.surfaceHi} 50%,${C.surface} 75%)`,
      backgroundSize: "200% 100%", animation: "nebula-shimmer 1.6s infinite",
    }} />
  );
}

/* ── Stat gradient card ─────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, glow }) {
  return (
    <div style={{
      ...glass({ padding: "14px 16px", flex: 1 }),
      boxShadow: `0 0 20px ${glow}18`, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -14, right: -14, width: 60, height: 60, borderRadius: "50%", background: glow, opacity: 0.08, filter: "blur(16px)" }} />
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: glow, fontFamily: "Manrope,sans-serif", letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── Empty state SVG illustration ──────────────────────────────── */
function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="55" fill="rgba(171,163,255,0.06)" />
      <circle cx="60" cy="60" r="38" fill="rgba(171,163,255,0.08)" />
      <path d="M42 55c0-10 6-18 18-18s18 8 18 18c0 4-1.5 8-4 11" stroke="#aba3ff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M78 66c2.5-3 4-7 4-11" stroke="#aba3ff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 55c-4 2-6 6-6 10 0 5 4 9 9 9h30c5 0 9-4 9-9 0-4-2-8-6-10" stroke="#aba3ff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 37v6M52 40l3 5M68 40l-3 5" stroke="#23eea8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="34" r="3" fill="#ffdb8f" opacity="0.7" />
      <circle cx="32" cy="44" r="2" fill="#aba3ff" opacity="0.6" />
      <circle cx="90" cy="80" r="2.5" fill="#23eea8" opacity="0.5" />
      <path d="M88 28l1.5 3 3 1.5-3 1.5L88 37l-1.5-2.5L84 33l2.5-1.5z" fill="#ffdb8f" opacity="0.4" />
    </svg>
  );
}

export default function Practice() {
  const { data: storeData, refreshAll } = useRealtimeStore();
  const user = storeData.users;
  const userId = user?.id;

  const [subject,      setSubject]      = useState("Physics");
  const [topic,        setTopic]        = useState("");
  const [difficulty,   setDifficulty]   = useState("Medium");
  const [questions,    setQuestions]    = useState(null);
  const [qIdx,         setQIdx]         = useState(0);
  const [selected,     setSelected]     = useState(null);
  const [revealed,     setRevealed]     = useState(false);
  const [startTime,    setStartTime]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [generatedCard,setGeneratedCard]= useState(null);
  const [adaptiveMode, setAdaptiveMode] = useState(true);

  // Live analytics from standard attempts and weak_topics arrays
  const analytics = useMemo(() => {
    const rawTopics = storeData.weak_topics?.sort((a,b) => a.score - b.score) || [];
    const weakTopicsList = rawTopics.slice(0, 6);
    const topWeak = weakTopicsList[0];

    const attempts = storeData.attempts || [];
    const total = attempts.length;
    const correctItems = attempts.filter(a => a.correct);
    const correctCount = correctItems.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    let totalSecs = 0;
    attempts.forEach(a => { totalSecs += (a.time_seconds || 0) });
    const avgTime = total > 0 ? Math.round(totalSecs / total) : 0;

    return { weakTopicsList, topWeak, accuracy, avgTime, attemptsTotal: total, correctCount };
  }, [storeData]);

  const { weakTopicsList, topWeak, accuracy, avgTime } = analytics;

  const loadQuestions = async (subOverride, topicOverride) => {
    const s = subOverride || subject;
    const t = topicOverride || topic;
    if (!s || !t) return;
    setLoading(true);
    setQIdx(0); setSelected(null); setRevealed(false); setGeneratedCard(null);
    try {
      const res = await generateQuestions(s, t, difficulty);
      setQuestions(res.data?.questions?.length ? res.data.questions : []);
    } catch { setQuestions([]); }
    setStartTime(Date.now());
    setLoading(false);
  };

  const practiceWeakest = () => {
    if (!topWeak) return;
    setSubject(topWeak.subject || subject);
    setTopic(topWeak.topic || "");
    setTimeout(() => loadQuestions(topWeak.subject || subject, topWeak.topic), 50);
  };

  const qs = questions || [];
  const q  = qs[qIdx];
  const progressPct = qs.length > 0 ? Math.round(((qIdx + (revealed ? 1 : 0)) / qs.length) * 100) : 0;

  const handleSelect = async (opt) => {
    if (revealed) return;
    setSelected(opt); setRevealed(true); setGeneratedCard(null);
    const timeSec = Math.round((Date.now() - startTime) / 1000);
    try {
      const res = await submitAnswer(userId, q.id, q.question, opt, q.answer, timeSec, subject, topic);
      if (res.data?.flashcard_generated) setGeneratedCard(res.data.flashcard_generated);
      refreshAll();
    } catch (e) { console.error(e); }
  };

  const nextQ = () => {
    setQIdx(i => i + 1); setSelected(null); setRevealed(false);
    setGeneratedCard(null); setStartTime(Date.now());
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes nebula-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse-glow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .practice-opt:hover { border-color: rgba(171,163,255,0.4) !important; background: rgba(171,163,255,0.05) !important; }
        .weak-row:hover { background: ${C.surfaceHi} !important; cursor: pointer; }
        .cta-btn:hover { filter: brightness(1.12); transform: scale(1.02); }
        .live-badge { display: inline-flex; alignItems: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${C.secondary}; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; background: ${C.secondary}15; border-radius: 12px; border: 1px solid ${C.secondary}33; }
      `}</style>

      <div style={{ padding: "24px 28px", fontFamily: "Inter,sans-serif", color: C.textPrimary, minHeight: "100vh" }}>

        {/* ── Header + Adaptive Toggle ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "Manrope,sans-serif", letterSpacing: -0.5, margin: 0 }}>
              🎯 Adaptive Practice
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "5px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
              AI detects weak areas and personalizes questions
              <span className="live-badge"><span style={{width:6, height:6, borderRadius:"50%", background:C.secondary, animation: "pulse-dot 1.5s infinite"}}/> Live Analytics</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...glass({ padding: "8px 14px" }) }}>
            <span style={{ fontSize: 12, color: adaptiveMode ? C.primary : C.textMuted, fontWeight: 600, transition: "color 0.2s" }}>
              ⚡ Adaptive Mode
            </span>
            <div
              onClick={() => setAdaptiveMode(m => !m)}
              style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer", position: "relative",
                background: adaptiveMode ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : C.surfaceTop,
                transition: "background 0.3s", boxShadow: adaptiveMode ? `0 0 12px ${C.primary}55` : "none",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: adaptiveMode ? 21 : 3, width: 16, height: 16,
                borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }} />
            </div>
          </div>
        </div>

        {/* ── Sticky AI Recommendation Banner ─────────────────── */}
        {topWeak && (
          <div
            style={{
              ...glass({ padding: "14px 20px", marginBottom: 22 }),
              position: "sticky", top: 8, zIndex: 30,
              background: "linear-gradient(135deg,rgba(171,163,255,.12),rgba(109,95,239,.08),rgba(35,238,168,.06))",
              boxShadow: `0 0 40px rgba(171,163,255,.15), 0 4px 20px rgba(0,0,0,0.3)`,
              display: "flex", alignItems: "center", gap: 14,
              animation: "fade-in 0.4s ease",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(171,163,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, animation: "pulse-glow 2.5s ease-in-out infinite" }}>🧠</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 3 }}>
                Live Analytics Recommendation
              </div>
              <div style={{ fontSize: 13, color: C.textPrimary }}>
                Practice <strong>{topWeak.topic}</strong>
                <span style={{ color: C.textMuted }}> — </span>
                <span style={{ color: C.error, fontWeight: 600 }}>{Math.round((topWeak.score || 40))}% accuracy</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}> · needs immediate revision</span>
              </div>
            </div>
            <button className="cta-btn" onClick={practiceWeakest} style={{ background: `linear-gradient(135deg,${C.error},#c23d58)`, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 4px 14px rgba(255,110,132,0.3)` }}>
              ⚡ Start AI Practice
            </button>
          </div>
        )}

        {/* ── Global Stats row ─────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
          <StatCard icon="🔥" label="Weakest Topic"  value={topWeak?.topic || "—"}     sub={topWeak?.subject || "No data yet"}  glow={C.error}     />
          <StatCard icon="⏱️" label="Global Avg Time"value={avgTime > 0 ? `${avgTime}s` : "—"} sub={avgTime > 30 ? "Slow response" : avgTime > 0 ? "Optimal speed" : "No attempts"} glow="#4a9eff" />
          <StatCard icon="📊" label="Global Accuracy"value={analytics.attemptsTotal>0?`${accuracy}%`:"—"} sub={analytics.attemptsTotal>0?`${analytics.correctCount}/${analytics.attemptsTotal} absolute correct`:"No attempts"} glow={accuracy>70?C.secondary:C.tertiary} />
          <StatCard icon="🎯" label="Focus Subject"  value={topWeak?.subject || subject} sub="Live calculated priority"       glow={C.primary}   />
        </div>

        {/* ── Two-column Main Layout ───────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 18, alignItems: "start" }}>

          {/* ── LEFT column ──────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Config card */}
            <div style={{ ...glass({ padding: "20px" }) }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 16 }}>⚙️ Configuration</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Subject</div>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Topic</div>
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. F block, Rotational Mechanics" style={{ width: "100%", padding: "10px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Difficulty</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {DIFFICULTIES.map(d => (
                    <button key={d} onClick={() => setDifficulty(d)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: difficulty === d ? `1px solid ${C.primary}55` : `1px solid ${C.outline}33`, background: difficulty === d ? `${C.primary}18` : "transparent", color: difficulty === d ? C.primary : C.textMuted }}>
                      {d === "Easy" ? "🟢" : d === "Medium" ? "🟡" : "🔴"} {d}
                    </button>
                  ))}
                </div>
              </div>

              <button className="cta-btn" onClick={() => loadQuestions()} disabled={loading || !subject || !topic} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: loading || !topic ? "not-allowed" : "pointer", background: loading || !topic ? C.surfaceTop : `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: loading || !topic ? C.textMuted : "#fff", fontSize: 13, fontWeight: 700, transition: "all 0.2s", boxShadow: !loading && topic ? `0 4px 20px ${C.primary}33` : "none" }}>
                {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />Generating…</span> : "⚡ Generate Questions"}
              </button>
            </div>

            {/* Weak Topics Panel */}
            <div style={{ ...glass({ padding: "18px 20px" }) }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>Live Weak Topics</div>
              </div>
              {weakTopicsList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {weakTopicsList.map((wt, i) => {
                    const pct = Math.round((wt.score || 40));
                    const col = pct < 40 ? C.error : pct < 70 ? C.tertiary : C.secondary;
                    return (
                      <div key={i} className="weak-row" onClick={() => { setSubject(wt.subject || subject); setTopic(wt.topic); }} style={{ padding: "8px 10px", borderRadius: 8, transition: "background 0.15s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{wt.topic}</span>
                            <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 6 }}>{wt.subject}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{pct}%</span>
                        </div>
                        <div style={{ height: 4, background: C.surfaceTop, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 2, boxShadow: `0 0 6px ${col}66`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>Practice some topics to see live weak area analytics.</p>
              )}
            </div>
          </div>

          {/* ── RIGHT column (question area) ──────────────────── */}
          <div>

            {/* Loading Skeleton */}
            {loading && (
              <div style={{ ...glass({ padding: "24px" }), animation: "fade-in 0.4s ease" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}><Sk w={80} h={20} r={8} /><Sk w={120} h={20} r={8} /></div>
                <Sk w="100%" h={8} r={4} />
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3,4].map(i => <Sk key={i} w="100%" h={52} r={10} />)}</div>
                <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 16 }}>AI generating {subject} questions on <strong style={{ color: C.primary }}>{topic}</strong>…</p>
              </div>
            )}

            {/* Question Card */}
            {q && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fade-in 0.3s ease" }}>
                {/* Progress header */}
                <div style={{ ...glass({ padding: "14px 18px" }) }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6 }}>Q{qIdx + 1} / {qs.length}</span>
                      <span style={{ fontSize: 10, color: C.textMuted, background: C.surfaceTop, padding: "3px 10px", borderRadius: 6 }}>{subject} · {topic}</span>
                      {q.concept_tested && <span style={{ fontSize: 10, color: "#4a9eff", background: "rgba(74,158,255,.12)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>{q.concept_tested}</span>}
                    </div>
                    <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{progressPct}%</span>
                  </div>
                  <div style={{ height: 6, background: C.surfaceTop, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, transition: "width 0.5s ease", width: `${progressPct}%`, background: `linear-gradient(90deg,${C.primaryDim},${C.primary},${C.secondary})`, boxShadow: `0 0 8px ${C.primary}66` }} />
                  </div>
                </div>

                {/* Question body */}
                <div style={{ ...glass({ padding: "22px" }) }}>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, marginBottom: 20, color: C.textPrimary }}>{q.question}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {q.options.map((opt, i) => {
                      let bg = C.surfaceTop, border = `1px solid ${C.outline}44`, color = C.textPrimary, shadow = "none";
                      if (revealed) {
                        if (opt === q.answer)    { bg = "rgba(35,238,168,.08)"; border = `1px solid ${C.secondary}55`; color = C.secondary; shadow = `0 0 12px ${C.secondary}22`; }
                        else if (opt === selected){ bg = "rgba(255,110,132,.08)"; border = `1px solid ${C.error}55`; color = C.error; shadow = `0 0 12px ${C.error}22`; }
                        else                     { bg = C.surface; color = C.textMuted; border = `1px solid ${C.outline}22`; }
                      }
                      return (
                        <div key={i} className={!revealed ? "practice-opt" : ""} onClick={() => handleSelect(opt)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, cursor: revealed ? "default" : "pointer", background: bg, border, color, boxShadow: shadow, transition: "all 0.2s" }}>
                          <span style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, background: revealed && opt === q.answer ? `${C.secondary}20` : revealed && opt === selected ? `${C.error}20` : C.surfaceTop, color: revealed && opt === q.answer ? C.secondary : revealed && opt === selected ? C.error : C.textMuted }}>{String.fromCharCode(65 + i)}</span>
                          <span style={{ fontSize: 13 }}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation + Navigation */}
                  {revealed && (
                    <div style={{ marginTop: 18, animation: "fade-in 0.3s ease" }}>
                      <div style={{ padding: "14px 16px", borderRadius: 10, background: selected === q.answer ? "rgba(35,238,168,.06)" : "rgba(255,110,132,.06)", border: `1px solid ${selected === q.answer ? C.secondary : C.error}33` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selected === q.answer ? C.secondary : C.error, marginBottom: 8 }}>{selected === q.answer ? "✅ Correct!" : `❌ Incorrect — Answer: ${q.answer}`}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}><strong style={{ color: C.textPrimary }}>Explanation:</strong> {q.explanation}</div>
                      </div>

                      {/* Flashcard notification */}
                      {selected !== q.answer && generatedCard && (
                        <div style={{ marginTop: 12, animation: "fade-in 0.3s ease", ...glass({ padding: "14px 16px" }), background: "linear-gradient(135deg,rgba(171,163,255,.1),rgba(109,95,239,.06))", border: `1px solid ${C.primary}33` }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📝</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Flashcard Auto-Generated</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{generatedCard.concept}{generatedCard.formula && <span style={{ marginLeft: 8, fontSize: 11, color: "#4a9eff", fontFamily: "monospace" }}>{generatedCard.formula}</span>}</div>
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{generatedCard.front}</div>
                              <div style={{ fontSize: 10, color: C.secondary, marginTop: 4 }}>✓ Added to live Revision queue</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Navigation */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
                        {qIdx < qs.length - 1 ? (
                          <button className="cta-btn" onClick={nextQ} style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>Next Question →</button>
                        ) : (
                          <>
                            <button onClick={loadQuestions} style={{ background: `${C.secondary}15`, color: C.secondary, border: `1px solid ${C.secondary}33`, borderRadius: 9, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔄 New Set</button>
                            <button onClick={() => setQuestions(null)} style={{ background: `${C.error}15`, color: C.error, border: `1px solid ${C.error}33`, borderRadius: 9, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✏️ Change Topic</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!q && !loading && (
              <div style={{ ...glass({ padding: "60px 40px" }), display: "flex", flexDirection: "column", alignItems: "center", animation: "fade-in 0.4s ease" }}>
                <EmptyIllustration />
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "Manrope,sans-serif", margin: "20px 0 8px" }}>Generate Adaptive Questions</h3>
                <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", maxWidth: 340, lineHeight: 1.6, margin: "0 0 24px" }}>Select a subject and topic from the config panel, then click<span style={{ color: C.primary, fontWeight: 600 }}> ⚡ Generate Questions</span> to start AI-powered practice.</p>
                <div style={{ display: "flex", gap: 20, fontSize: 11, color: C.textMuted }}>{[ { dot: C.secondary, label: "Real-time analytics" }, { dot: C.primary,   label: "Adaptive difficulty" }, { dot: C.tertiary,  label: "Weak-area detection" } ].map((f, i) => (<span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot, flexShrink: 0, boxShadow: `0 0 6px ${f.dot}` }} />{f.label}</span>))}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}