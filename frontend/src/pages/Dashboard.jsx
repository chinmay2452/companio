import { useState, useEffect } from "react";
import { getTodayPlan, generatePlan, getUserStats, getWeakAreas } from "../lib/api";
import useAppStore from "../store/useAppStore";

/* ── Design tokens (Companio Nebula) ───────────────────────────── */
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

/* ── Glassmorphism card base ─────────────────────────────────────── */
const glass = (extra = {}) => ({
  background: "rgba(26, 37, 62, 0.6)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid rgba(64, 72, 91, 0.25)`,
  borderRadius: 16,
  ...extra,
});

/* ── Type colours for plan items ─────────────────────────────────── */
const TYPE_META = {
  NEW:      { dot: C.primary,   badge: { bg: "rgba(171,163,255,.15)", color: C.primary   } },
  REVISE:   { dot: C.secondary, badge: { bg: "rgba(35,238,168,.12)",  color: C.secondary } },
  PRACTICE: { dot: C.tertiary,  badge: { bg: "rgba(255,219,143,.12)", color: C.tertiary  } },
  BREAK:    { dot: C.textMuted, badge: { bg: "rgba(163,171,193,.10)", color: C.textMuted } },
};

const EXAM_OPTIONS = ["JEE", "NEET", "UPSC"];
const EXAM_SUBJECTS = {
  JEE:  ["Physics", "Chemistry", "Maths"],
  NEET: ["Physics", "Chemistry", "Biology"],
  UPSC: ["History", "Geography", "Polity", "Economy", "Science"],
};

/* ─────────── Skeleton shimmer ───────────────────────────────────── */
function Skeleton({ w = "100%", h = 20, r = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: `linear-gradient(90deg, ${C.surface} 25%, ${C.surfaceHi} 50%, ${C.surface} 75%)`,
      backgroundSize: "200% 100%",
      animation: "nebula-shimmer 1.6s infinite",
    }} />
  );
}

/* ─────────── Circular SVG retention chart ───────────────────────── */
function RetentionChart({ pct = 72 }) {
  const r = 44, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke={C.surfaceTop} strokeWidth={10} />
        <circle
          cx={55} cy={55} r={r} fill="none"
          stroke={C.secondary} strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${C.secondary}88)` }}
        />
        <text x="55" y="51" textAnchor="middle" fill={C.textPrimary} fontSize="18" fontWeight="800" fontFamily="Manrope, Inter, sans-serif">{pct}%</text>
        <text x="55" y="67" textAnchor="middle" fill={C.textMuted} fontSize="10" fontFamily="Inter, sans-serif">Health</text>
      </svg>
      <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Memory Health</span>
    </div>
  );
}

/* ─────────── Stat card ──────────────────────────────────────────── */
function StatCard({ label, value, glow, icon, loading }) {
  return (
    <div style={{
      ...glass({ padding: "18px 20px", flex: 1, position: "relative", overflow: "hidden" }),
      boxShadow: `0 0 28px ${glow}22`,
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 32px ${glow}44`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "none";           e.currentTarget.style.boxShadow = `0 0 28px ${glow}22`; }}
    >
      {/* Background glow blob */}
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: glow, opacity: 0.08, filter: "blur(24px)", pointerEvents: "none" }} />
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 10 }}>{icon} {label}</div>
      {loading
        ? <Skeleton w="60%" h={32} r={6} />
        : <div style={{ fontSize: 28, fontWeight: 800, color: glow, letterSpacing: -0.5, lineHeight: 1.1, fontFamily: "Manrope, sans-serif" }}>{value}</div>
      }
    </div>
  );
}

/* ─────────── Focus chip ─────────────────────────────────────────── */
function FocusChip({ icon, label, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 10,
      border: `1px solid ${color}44`,
      background: `${color}12`,
      cursor: "default",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color, letterSpacing: 0.3 }}>{label}</span>
    </div>
  );
}

/* ─────────── Main component ─────────────────────────────────────── */
export default function Dashboard() {
  const user         = useAppStore(s => s.user);
  const userId       = user?.id;
  const userName     = user?.name || "Student";
  const storeExam    = useAppStore(s => s.examType) || "JEE";

  const [plan,            setPlan]            = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [statsLoading,    setStatsLoading]    = useState(true);
  const [done,            setDone]            = useState({});
  const [stats,           setStats]           = useState({ due: 0, weak: "—", retention: 0, streak: 0 });
  const [examType,        setExamType]        = useState(storeExam);
  const [hours,           setHours]           = useState(6);
  const [showConfig,      setShowConfig]      = useState(false);
  const [planLoaded,      setPlanLoaded]      = useState(false);
  const [selectedSubjects,setSelectedSubjects]= useState(EXAM_SUBJECTS[storeExam] || []);
  const [topicsFocus,     setTopicsFocus]     = useState("");

  useEffect(() => { setSelectedSubjects(EXAM_SUBJECTS[examType] || []); }, [examType]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getTodayPlan(userId);
        if (res.data?.plan?.length) { setPlan(res.data.plan); setPlanLoaded(true); }
      } catch { /* no plan yet */ }

      try {
        const [statsRes, weakRes] = await Promise.all([
          getUserStats(userId),
          getWeakAreas(userId),
        ]);
        const d = statsRes.data || {};
        const weakTopic = weakRes.data?.weak_areas?.[0]?.topic ?? "—";
        setStats({
          due:       d.cards_due_today ?? d.total_cards ?? 0,
          weak:      weakTopic,
          retention: d.avg_score ? Math.round(d.avg_score * 20) : 72,
          streak:    d.streak ?? 0,
        });
      } catch { /* keep defaults */ }
      setStatsLoading(false);
    })();
  }, [userId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generatePlan(userId, examType, hours, null, selectedSubjects, topicsFocus);
      if (res.data?.plan) {
        const normalized = (Array.isArray(res.data.plan) ? res.data.plan : []).map((item, i) => ({
          time:         item.time || `${8 + i}:00 AM`,
          type:         (item.type || "NEW").toUpperCase(),
          topic:        item.topic || "Study session",
          detail:       item.detail || `${item.duration_min || 30} min · ${item.priority || "medium"} priority`,
          subject:      item.subject || "",
          duration_min: item.duration_min || 30,
          priority:     item.priority || "medium",
        }));
        setPlan(normalized);
        setPlanLoaded(true);
        setDone({});
        setShowConfig(false);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleSubject = s => setSelectedSubjects(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const doneCount = Object.values(done).filter(Boolean).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {/* ── Global animation styles ─────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes nebula-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
        .plan-item:hover { background: ${C.surfaceHi} !important; }
        .cta-btn:hover { transform: scale(1.03); filter: brightness(1.1); }
      `}</style>

      <div style={{ padding: "28px 32px", fontFamily: "Inter, sans-serif", color: C.textPrimary, minHeight: "100vh" }}>

        {/* ── Two-column outer wrapper ──────────────────────── */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── LEFT column (main content) ─────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.6, fontFamily: "Manrope, sans-serif", margin: 0 }}>
                  {greeting}, {userName} 👋
                </h1>
                <p style={{ color: C.textMuted, fontSize: 13, marginTop: 5, margin: "5px 0 0" }}>
                  {planLoaded
                    ? `Your ${examType} plan is ready — ${plan.length} sessions scheduled`
                    : `Tap "Generate AI Plan" to build your ${examType} schedule`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  style={{ background: showConfig ? C.surfaceTop : C.surface, color: C.textPrimary, border: `1px solid ${C.outline}55`, borderRadius: 10, padding: "9px 14px", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}
                >⚙️ Config</button>
                <button
                  className="cta-btn"
                  onClick={handleGenerate}
                  disabled={loading}
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", transition: "all 0.2s", opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "⏳ Generating…" : "✨ Generate AI Plan"}
                </button>
              </div>
            </div>

            {/* Config panel */}
            {showConfig && (
              <div style={{ ...glass({ padding: "20px 24px", marginBottom: 24 }) }}>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>Exam</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {EXAM_OPTIONS.map(e => (
                        <button key={e} onClick={() => setExamType(e)} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${examType === e ? C.primary : C.outline}33`, background: examType === e ? `${C.primary}18` : "transparent", color: examType === e ? C.primary : C.textMuted, cursor: "pointer" }}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>Available Hours</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[3, 4, 6, 8, 10].map(h => (
                        <button key={h} onClick={() => setHours(h)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${hours === h ? C.secondary : C.outline}33`, background: hours === h ? `${C.secondary}18` : "transparent", color: hours === h ? C.secondary : C.textMuted, cursor: "pointer" }}>{h}h</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>Subjects</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(EXAM_SUBJECTS[examType] || []).map(s => {
                      const on = selectedSubjects.includes(s);
                      return (
                        <button key={s} onClick={() => toggleSubject(s)} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? C.tertiary : C.outline}33`, background: on ? `${C.tertiary}15` : "transparent", color: on ? C.tertiary : C.textMuted, cursor: "pointer" }}>
                          {on ? "✓ " : "+ "}{s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>Topic Focus (optional)</div>
                  <input
                    type="text"
                    placeholder="e.g. Rotational Mechanics, Thermodynamics..."
                    value={topicsFocus}
                    onChange={e => setTopicsFocus(e.target.value)}
                    style={{ width: "100%", padding: "9px 14px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            )}

            {/* AI Insight Banner */}
            <div style={{
              ...glass({ padding: "16px 20px", marginBottom: 24 }),
              background: `linear-gradient(135deg, rgba(171,163,255,.12), rgba(109,95,239,.08))`,
              boxShadow: `0 0 40px rgba(171,163,255,.15)`,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ fontSize: 22, animation: "pulse-ring 2s ease-in-out infinite" }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 3, fontWeight: 700 }}>AI Insight</div>
                <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5 }}>
                  {stats.weak !== "—"
                    ? `Your retention on ${stats.weak} is dropping — a 30 min revision block is recommended today.`
                    : "Keep practicing to unlock personalized AI study recommendations."}
                </div>
              </div>
              {stats.weak !== "—" && (
                <button className="cta-btn" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Apply Suggestion
                </button>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
              <StatCard label="Cards Due"       icon="📚" value={stats.due}       glow={C.error}     loading={statsLoading} />
              <StatCard label="Weakest Topic"   icon="⚠️" value={stats.weak}      glow="#ff9a3c"     loading={statsLoading} />
              <StatCard label="Retention"       icon="🧠" value={`${stats.retention}%`} glow={C.secondary} loading={statsLoading} />
              <StatCard label="Day Streak"      icon="🔥" value={`${stats.streak}d`}  glow={C.primary}   loading={statsLoading} />
            </div>

            {/* Progress bar (when plan exists) */}
            {plan.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Today's Progress</span>
                  <span style={{ fontSize: 11, color: C.secondary, fontFamily: "monospace" }}>{doneCount}/{plan.length} sessions</span>
                </div>
                <div style={{ height: 6, background: C.surfaceTop, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${C.secondary}, ${C.primary})`, width: `${(doneCount / plan.length) * 100}%`, transition: "width 0.5s ease", boxShadow: `0 0 8px ${C.secondary}88` }} />
                </div>
              </div>
            )}

            {/* Study Plan Timeline */}
            <div style={{ ...glass({ padding: "22px 24px" }) }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>
                  📅 Today's Study Plan
                </div>
                {planLoaded && (
                  <span style={{ fontSize: 10, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                    AI-Generated
                  </span>
                )}
              </div>

              {/* Empty state */}
              {plan.length === 0 && !loading && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
                  <div style={{ fontSize: 42, marginBottom: 12 }}>📚</div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>No plan for today yet</div>
                  <div style={{ fontSize: 12 }}>Click <strong style={{ color: C.textPrimary }}>⚙️ Config</strong> then <strong style={{ color: C.primary }}>Generate AI Plan</strong></div>
                </div>
              )}

              {/* Loading skeleton */}
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <Skeleton w={64} h={18} r={6} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <Skeleton w="40%" h={14} r={4} />
                        <Skeleton w="70%" h={16} r={4} />
                        <Skeleton w="55%" h={12} r={4} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline items */}
              {!loading && plan.length > 0 && (
                <div style={{ position: "relative" }}>
                  {/* Vertical timeline line */}
                  <div style={{ position: "absolute", left: 100, top: 12, bottom: 12, width: 1, background: `linear-gradient(to bottom, ${C.primary}55, ${C.secondary}55)`, borderRadius: 1 }} />

                  {plan.map((item, i) => {
                    const typeStr = (item.type || "NEW").toUpperCase();
                    const meta = TYPE_META[typeStr] || TYPE_META.NEW;
                    return (
                      <div
                        key={i}
                        className="plan-item"
                        style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 10px", borderRadius: 10, marginBottom: 4, opacity: done[i] ? 0.4 : 1, transition: "opacity 0.3s, background 0.15s", cursor: "default" }}
                      >
                        {/* Time stamp */}
                        <div style={{ width: 76, fontSize: 11, color: C.textMuted, fontFamily: "monospace", paddingTop: 2, flexShrink: 0, textAlign: "right", paddingRight: 8 }}>
                          {item.time}
                        </div>

                        {/* Dot on timeline */}
                        <div style={{ position: "relative", zIndex: 1, flexShrink: 0, marginTop: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.dot, boxShadow: `0 0 8px ${meta.dot}99` }} />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: meta.badge.bg, color: meta.badge.color, letterSpacing: 0.5 }}>
                              {typeStr}
                            </span>
                            {item.subject && <span style={{ fontSize: 10, color: C.textMuted }}>{item.subject}</span>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, textDecoration: done[i] ? "line-through" : "none" }}>{item.topic}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.detail}</div>
                        </div>

                        {/* Check toggle */}
                        <div
                          style={{ cursor: "pointer", fontSize: 18, color: done[i] ? C.secondary : C.outline, transition: "color 0.2s", flexShrink: 0, paddingTop: 2 }}
                          onClick={() => setDone(p => ({ ...p, [i]: !p[i] }))}
                        >
                          {done[i] ? "✅" : "○"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT column ───────────────────────────────────── */}
          <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Retention health chart */}
            <div style={{ ...glass({ padding: "22px 16px", textAlign: "center" }) }}>
              {statsLoading
                ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><Skeleton w={110} h={110} r={55} /><Skeleton w="70%" h={12} r={4} /></div>
                : <RetentionChart pct={stats.retention} />
              }
            </div>

            {/* Today's Focus chips */}
            <div style={{ ...glass({ padding: "18px 16px" }) }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12, fontWeight: 700 }}>Today's Focus</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FocusChip icon="⚠️" label="Weak"        color={C.error}     />
                <FocusChip icon="📅" label="Due Cards"   color="#ff9a3c"     />
                <FocusChip icon="✨" label="Recommended" color={C.primary}   />
              </div>
            </div>

            {/* Study Focus Areas */}
            {plan.filter(s => s.priority === "high" || (s.type || "").toUpperCase() === "REVISE").length > 0 && (
              <div style={{ ...glass({ padding: "18px 16px" }) }}>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12, fontWeight: 700 }}>Priority</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.filter(s => s.priority === "high" || (s.type || "").toUpperCase() === "REVISE").slice(0, 3).map((r, i) => {
                    const pct = r.priority === "high" ? 30 + i * 15 : 60 + i * 10;
                    const col = pct < 50 ? C.error : pct < 70 ? C.tertiary : C.secondary;
                    return (
                      <div key={i}>
                        <div style={{ fontSize: 11, color: C.textPrimary, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.topic}</div>
                        <div style={{ height: 4, background: C.surfaceTop, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: col, boxShadow: `0 0 6px ${col}88` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}