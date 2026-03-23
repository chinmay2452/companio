import React, { useState, useMemo, useEffect } from "react";
import { useRealtimeStore } from "../hooks/useRealtimeStore";
import useAppStore from "../store/useAppStore";
import { generatePlan } from "../lib/api";

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

const glass = (extra = {}) => ({
  background: "rgba(26, 37, 62, 0.6)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid rgba(64, 72, 91, 0.25)`,
  borderRadius: 16,
  ...extra,
});

const TYPE_META = {
  NEW:      { dot: C.primary,   badge: { bg: "rgba(171,163,255,.15)", color: C.primary   } },
  REVISE:   { dot: C.secondary, badge: { bg: "rgba(35,238,168,.12)",  color: C.secondary } },
  PRACTICE: { dot: C.tertiary,  badge: { bg: "rgba(255,219,143,.12)", color: C.tertiary  } },
  BREAK:    { dot: C.textMuted, badge: { bg: "rgba(163,171,193,.10)", color: C.textMuted } },
};

/* ─────────── Helper Components ──────────────────────────────────── */

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

function StatCard({ label, value, glow, icon, loading }) {
  return (
    <div style={{
      ...glass({ padding: "18px 20px", flex: 1, position: "relative", overflow: "hidden" }),
      boxShadow: `0 0 28px ${glow}22`, transition: "transform 0.2s, box-shadow 0.2s",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: glow, opacity: 0.08, filter: "blur(24px)", pointerEvents: "none" }} />
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 10 }}>{icon} {label}</div>
      {loading ? <Skeleton w="60%" h={32} r={6} />
               : <div style={{ fontSize: 26, fontWeight: 800, color: glow, letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>}
    </div>
  );
}

function ProgressRing({ pct, color = C.secondary, size = 100, label, subtext }) {
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surfaceTop} strokeWidth={size*0.08} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.08} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x="50%" y="47%" textAnchor="middle" fill={C.textPrimary} fontSize={size*0.2} fontWeight="800" dy=".3em">{Math.round(pct)}%</text>
        {label && <text x="50%" y="65%" textAnchor="middle" fill={C.textMuted} fontSize={size*0.1} dy=".3em">{label}</text>}
      </svg>
      {subtext && <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>{subtext}</span>}
    </div>
  );
}

function BarChart({ data, height = 120, maxVal = 100 }) {
  if (data.length === 0) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 12 }}>Not enough data</div>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 20 }}>
      {data.map((d, i) => {
        const pct = Math.max(0, Math.min(100, (d.value / maxVal) * 100));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
            <div style={{ position: "relative", width: "100%", flex: 1, display: "flex", alignItems: "flex-end", background: C.surfaceTop, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: "100%", height: `${pct}%`, background: `linear-gradient(to top, ${d.color}aa, ${d.color})`, transition: "height 0.8s ease", borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              <div style={{ position: "absolute", bottom: `${pct}%`, left: "50%", transform: "translate(-50%, -4px)", fontSize: 9, color: d.color, fontWeight: 700, opacity: pct > 10 ? 1 : 0 }}>{Math.round(d.value)}</div>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Main Dashboard ─────────────────────────────────────── */
export default function Dashboard() {
  const { data: storeData, loading: storeLoading } = useRealtimeStore();
  const authUser = useAppStore(s => s.user);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [doneItems, setDoneItems] = useState({});
  const [localPlan, setLocalPlan] = useState(null); // direct API response fallback
  const [showConfig, setShowConfig] = useState(false);

  // ── Config state ──
  const [cfgHours, setCfgHours] = useState(4);
  const [cfgSubjects, setCfgSubjects] = useState([]);
  const [cfgTopicFocus, setCfgTopicFocus] = useState("");

  // Derive subject options from the user's signup profile
  const userProfile = storeData?.users || {};
  const SUBJECT_OPTIONS = userProfile.preferred_subjects && userProfile.preferred_subjects.length > 0
    ? userProfile.preferred_subjects
    : ["Physics", "Chemistry", "Maths", "Biology"]; // fallback if profile not loaded

  // Initialize config from user profile once loaded
  useEffect(() => {
    if (userProfile && Object.keys(userProfile).length > 0) {
      if (userProfile.daily_goal_hours) setCfgHours(userProfile.daily_goal_hours);
      if (userProfile.preferred_subjects?.length > 0) setCfgSubjects(userProfile.preferred_subjects);
    }
  }, [userProfile?.id]); // only re-run when user changes

  const toggleSubject = (s) => {
    setCfgSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // Memoized Stats
  const stats = useMemo(() => {
    if (storeLoading) return null;
    const now = new Date();
    
    // Cards
    const dueCount = storeData.cards.filter(c => new Date(c.next_review || c.due_date || now) <= now).length;

    // Plans — try both `plan_date` and `date` column names
    const todayStr = new Date().toISOString().split("T")[0];
    const todaysPlanRow = storeData.daily_plans.find(p => (p.plan_date || p.date) === todayStr);
    const realtimePlanItems = todaysPlanRow?.plan || [];

    // Weak topics
    const weakTopics = [...(storeData.weak_topics || [])].sort((a,b) => (a.score || a.accuracy || 0) - (b.score || b.accuracy || 0));
    const topWeak = weakTopics[0];

    // Attempts
    const attempts = storeData.attempts || [];
    const correctAttempts = attempts.filter(a => a.correct).length;
    const overallAccuracy = attempts.length ? (correctAttempts / attempts.length) * 100 : 0;
    
    const subjectPerf = {};
    attempts.forEach(a => {
      if (!subjectPerf[a.subject]) subjectPerf[a.subject] = { total: 0, correct: 0 };
      subjectPerf[a.subject].total += 1;
      if (a.correct) subjectPerf[a.subject].correct += 1;
    });
    const subjectData = Object.keys(subjectPerf).map(sub => {
      const p = subjectPerf[sub];
      return { label: sub.substring(0,3), value: (p.correct/p.total)*100 || 0, color: C.tertiary };
    });

    // Micro Sessions
    const microSess = storeData.micro_sessions || [];
    const microToday = microSess.filter(m => String(m.created_at).startsWith(todayStr)).length;
    const totalMicroMin = microSess.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

    return {
      appName: "Companio AI",
      user: storeData.users || {},
      dueCount,
      realtimePlanItems,
      weakTopics,
      topWeak,
      overallAccuracy,
      subjectData,
      microToday,
      totalMicroMin,
    };
  }, [storeData, storeLoading]);

  // Loading state
  if (storeLoading || !stats) {
    return (
      <div style={{ padding: "32px", height: "100vh", background: C.bg }}>
        <Skeleton w="30%" h={32} />
        <div style={{ marginTop: 24, display: "flex", gap: 16 }}>
          <Skeleton w="25%" h={100} /><Skeleton w="25%" h={100} /><Skeleton w="25%" h={100} /><Skeleton w="25%" h={100} />
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 16 }}>
          <Skeleton w="60%" h={400} /><Skeleton w="40%" h={400} />
        </div>
      </div>
    );
  }

  const { user, dueCount, realtimePlanItems, weakTopics, topWeak, overallAccuracy, subjectData, microToday, totalMicroMin } = stats;
  // Use local plan (from API response) if available, otherwise fallback to realtime
  const planItems = localPlan || realtimePlanItems;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const doneCount = Object.values(doneItems).filter(Boolean).length;
  const planProgressPct = planItems.length > 0 ? (doneCount / planItems.length) * 100 : 0;

  const handleGeneratePlan = async () => {
    const userId = authUser?.id || user?.id;
    if (!userId) { console.error("No user ID available"); return; }
    setGeneratingPlan(true);
    setLocalPlan(null);
    setDoneItems({});
    try {
      if (!userProfile?.exam_type) throw new Error("Exam type not loaded from profile yet.");
      const res = await generatePlan(userId, userProfile.exam_type, cfgHours, null, cfgSubjects, cfgTopicFocus);
      const planData = res.data?.plan || [];
      setLocalPlan(planData);
      setShowConfig(false);
    } catch(err) {
      console.error(err);
      alert("Failed to generate plan: " + (err.response?.data?.detail || err.message));
    }
    setGeneratingPlan(false);
  };

  const inputStyle = { width: "100%", padding: "9px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes nebula-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .live-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${C.secondary}; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; background: ${C.secondary}15; border-radius: 12px; border: 1px solid ${C.secondary}33; }
        .cfg-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
        .subj-chip:hover { filter: brightness(1.15); }
      `}</style>
      
      <div style={{ padding: "28px 32px", fontFamily: "Inter, sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, animation: "fade-in 0.3s ease-out" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "Manrope, sans-serif", margin: 0, letterSpacing: -0.5 }}>
              {greeting}, {user.name || "Student"} 👋
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
              <span>Target: <strong style={{color: C.textPrimary}}>{userProfile.exam_type || "JEE"}</strong></span>
              • <span>Goal: <strong style={{color: C.textPrimary}}>{cfgHours}h / day</strong></span>
              <span className="live-badge"><span style={{width:6, height:6, borderRadius:"50%", background:C.secondary, animation: "pulse-dot 1.5s infinite"}}/> Live Sync</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="cfg-btn"
              onClick={() => setShowConfig(p => !p)}
              style={{
                background: showConfig ? `${C.primary}30` : C.surfaceTop,
                color: showConfig ? C.primary : C.textMuted,
                border: `1px solid ${showConfig ? C.primary + '55' : C.outline + '33'}`,
                borderRadius: 10, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
              }}
            >
              ⚙️ {showConfig ? "Hide Config" : "Config"}
            </button>
            <button
              className="cfg-btn"
              onClick={handleGeneratePlan}
              disabled={generatingPlan || cfgSubjects.length === 0}
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})`,
                color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 12, fontWeight: 700,
                cursor: generatingPlan ? "wait" : "pointer", opacity: generatingPlan || cfgSubjects.length === 0 ? 0.6 : 1,
                boxShadow: `0 4px 14px ${C.primary}44`, transition: "all 0.2s",
              }}
            >
              {generatingPlan ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  Generating…
                </span>
              ) : "✨ Generate AI Plan"}
            </button>
          </div>
        </div>

        {/* ── Config Panel ─────────────────────────────────────── */}
        {showConfig && (
          <div style={{ ...glass({ padding: "22px 24px", marginBottom: 22 }), animation: "fade-in 0.25s ease", border: `1px solid ${C.primary}33` }}>
            <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 16 }}>⚙️ Planner Configuration</div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Study Hours</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[2, 4, 6, 8].map(h => (
                  <button key={h} onClick={() => setCfgHours(h)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                    border: cfgHours === h ? `1px solid ${C.secondary}55` : `1px solid ${C.outline}33`,
                    background: cfgHours === h ? `${C.secondary}18` : "transparent",
                    color: cfgHours === h ? C.secondary : C.textMuted,
                  }}>{h}h</button>
                ))}
              </div>
            </div>

            {/* Subjects */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Subjects (select all that apply)</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SUBJECT_OPTIONS.map(s => {
                  const active = cfgSubjects.includes(s);
                  return (
                    <button key={s} className="subj-chip" onClick={() => toggleSubject(s)} style={{
                      padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      border: active ? `1px solid ${C.primary}55` : `1px solid ${C.outline}33`,
                      background: active ? `${C.primary}20` : "transparent",
                      color: active ? C.primary : C.textMuted,
                    }}>
                      {active ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic Focus */}
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Topic Focus (optional)</div>
              <input
                value={cfgTopicFocus}
                onChange={e => setCfgTopicFocus(e.target.value)}
                placeholder="e.g. Organic Chemistry, Rotational Mechanics, Integration"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Global Stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, animation: "fade-in 0.4s ease-out" }}>
          <StatCard label="Due Cards" icon="⏰" value={dueCount} glow={dueCount > 0 ? C.error : C.secondary} />
          <StatCard label="Avg Accuracy" icon="🎯" value={`${Math.round(overallAccuracy)}%`} glow={overallAccuracy > 75 ? C.secondary : C.tertiary} />
          <StatCard label="Plan Progress" icon="📈" value={`${Math.round(planProgressPct)}%`} glow={planProgressPct === 100 ? C.secondary : planProgressPct > 0 ? C.tertiary : C.textMuted} />
          <StatCard label="Total Practice" icon="⏱" value={`${totalMicroMin}m`} glow={C.primary} />
        </div>

        {/* Split Grid */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          
          {/* Main Content (Left) */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, animation: "fade-in 0.5s ease-out" }}>
            
            {/* AI Insight Banner */}
            {topWeak && (
              <div style={{ ...glass({ padding: "20px 24px" }), background: `linear-gradient(135deg, ${C.primary}15, ${C.primaryDim}05)`, border: `1px solid ${C.primary}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 28 }}>🤖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 800, marginBottom: 4 }}>AI Adaptive Recommendation</div>
                    <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.5 }}>
                      Your accuracy in <strong style={{color: C.tertiary}}>{topWeak.topic}</strong> is struggling (<span style={{color: C.error}}>{topWeak.score || topWeak.accuracy}%</span>). We added 5 priority cards to your revision queue.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Activity Timeline */}
            <div style={{ ...glass({ padding: "24px" }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: C.textPrimary, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>📅 Today's AI Study Plan</div>
                {planItems.length > 0 && <div style={{ fontSize: 11, color: C.textMuted }}>{doneCount} / {planItems.length} Completed</div>}
              </div>

              {/* Generating skeleton */}
              {generatingPlan ? (
                <div style={{ padding: "20px 0" }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ display: "flex", gap: 16, marginBottom: 14, alignItems: "center" }}>
                      <Skeleton w={60} h={16} r={4} />
                      <Skeleton w={12} h={12} r={6} />
                      <Skeleton w="70%" h={18} r={6} />
                    </div>
                  ))}
                  <div style={{ textAlign: "center", fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: `2px solid ${C.primary}44`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                      AI is generating your personalized plan…
                    </span>
                  </div>
                </div>
              ) : planItems.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: C.textMuted }}>
                  <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No Plan Yet</div>
                  <div style={{ fontSize: 12, maxWidth: 320, margin: "0 auto 18px", lineHeight: 1.6 }}>
                    Click <strong style={{ color: C.primary }}>⚙️ Config</strong> to choose your subjects & hours, then click <strong style={{ color: C.primary }}>✨ Generate AI Plan</strong>
                  </div>
                  <button
                    className="cfg-btn"
                    onClick={() => setShowConfig(true)}
                    style={{ background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 9, padding: "9px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    ⚙️ Open Config
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 85, top: 10, bottom: 10, width: 2, background: C.surfaceTop, borderRadius: 1 }} />
                  {planItems.map((item, i) => {
                    const done = !!doneItems[i];
                    const meta = TYPE_META[item.type?.toUpperCase()] || TYPE_META.NEW;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 12, padding: "8px 0", opacity: done ? 0.4 : 1, transition: "all 0.2s" }}>
                        <div style={{ width: 64, textAlign: "right", fontSize: 11, color: C.textMuted, fontFamily: "monospace", paddingTop: 3 }}>{item.time || "10:00"}</div>
                        <div style={{ position: "relative", zIndex: 1, marginTop: 4 }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: meta.dot, border: `2px solid ${C.surface}`, boxShadow: `0 0 10px ${meta.dot}88` }} />
                        </div>
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setDoneItems(p => ({...p, [i]: !p[i]}))}>
                         <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                           <span style={{ fontSize: 9, fontWeight: 800, color: meta.badge.color, background: meta.badge.bg, padding: "2px 6px", borderRadius: 4 }}>{item.type}</span>
                           {item.priority && (
                             <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                               color: item.priority === "high" ? C.error : item.priority === "medium" ? C.tertiary : C.textMuted,
                               background: item.priority === "high" ? `${C.error}15` : item.priority === "medium" ? `${C.tertiary}15` : `${C.textMuted}15`,
                             }}>{item.priority}</span>
                           )}
                           <span style={{ fontSize: 13, fontWeight: 700, color: done ? C.textMuted : C.textPrimary, textDecoration: done ? "line-through" : "none" }}>{item.topic}</span>
                         </div>
                         <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                           {item.subject && <span style={{ fontSize: 10, color: C.primary, background: `${C.primary}12`, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{item.subject}</span>}
                           {item.duration_min && <span style={{ fontSize: 10, color: C.textMuted }}>⏱ {item.duration_min}min</span>}
                         </div>
                         {item.detail && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{item.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Analytics (Right) */}
          <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24, animation: "fade-in 0.6s ease-out" }}>
            
            {/* Memory Health component */}
            <div style={{ ...glass({ padding: "24px 20px" }) }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 16 }}>Retention Health</div>
              <ProgressRing pct={overallAccuracy || 0} label="Health" color={overallAccuracy > 70 ? C.secondary : C.error} size={140} />
            </div>

            {/* Subject Performance */}
            <div style={{ ...glass({ padding: "20px" }) }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>Subject Perf.</div>
              <BarChart data={subjectData} height={130} />
            </div>

            {/* Focus List */}
            {weakTopics.length > 0 && (
               <div style={{ ...glass({ padding: "20px" }) }}>
                 <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 12 }}>Weakest Topics</div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                   {weakTopics.slice(0, 3).map((w, i) => (
                     <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.surfaceTop, borderRadius: 8 }}>
                       <span style={{ fontSize: 11, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "60%" }}>{w.topic}</span>
                       <span style={{ fontSize: 11, fontWeight: 700, color: (w.score || w.accuracy || 0) < 50 ? C.error : C.tertiary }}>{w.score || w.accuracy}%</span>
                     </div>
                   ))}
                 </div>
               </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}