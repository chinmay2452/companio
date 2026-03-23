import React, { useState, useMemo } from "react";
import { useRealtimeStore } from "../hooks/useRealtimeStore";
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
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [doneItems, setDoneItems] = useState({});

  // Memoized Stats
  const stats = useMemo(() => {
    if (storeLoading) return null;
    const now = new Date();
    
    // Cards
    const dueCount = storeData.cards.filter(c => new Date(c.next_review || now) <= now).length;
    const trackedCount = storeData.cards.length;

    // Plans
    const todayStr = new Date().toISOString().split("T")[0];
    const todaysPlanRow = storeData.daily_plans.find(p => p.date === todayStr);
    const planItems = todaysPlanRow?.plan || [];

    // Weak topics
    const weakTopics = storeData.weak_topics?.sort((a,b) => a.score - b.score) || [];
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
      trackedCount,
      planItems,
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

  const { user, dueCount, planItems, weakTopics, topWeak, overallAccuracy, subjectData, microToday, totalMicroMin } = stats;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const doneCount = Object.values(doneItems).filter(Boolean).length;

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      await generatePlan(user.id, user.exam_type || "JEE", user.daily_goal_hours || 4, null, user.preferred_subjects || [], "");
    } catch(err) { console.error(err); }
    setGeneratingPlan(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes nebula-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .live-badge { display: inline-flex; alignItems: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${C.secondary}; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; background: ${C.secondary}15; border-radius: 12px; border: 1px solid ${C.secondary}33; }
      `}</style>
      
      <div style={{ padding: "28px 32px", fontFamily: "Inter, sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, animation: "fade-in 0.3s ease-out" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "Manrope, sans-serif", margin: 0, letterSpacing: -0.5 }}>
              {greeting}, {user.name || "Student"} 👋
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
              <span>Target: <strong style={{color: C.textPrimary}}>{user.exam_type} {user.target_year}</strong></span>
              • <span>Goal: <strong style={{color: C.textPrimary}}>{user.daily_goal_hours}h / day</strong></span>
              <span className="live-badge"><span style={{width:6, height:6, borderRadius:"50%", background:C.secondary, animation: "pulse-dot 1.5s infinite"}}/> Live Sync</span>
            </p>
          </div>
          <div>
            <button onClick={handleGeneratePlan} disabled={generatingPlan} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 12, fontWeight: 700, cursor: generatingPlan ? "wait" : "pointer", opacity: generatingPlan ? 0.7 : 1, boxShadow: `0 4px 14px ${C.primary}44` }}>
              {generatingPlan ? "⏳ Generating..." : "✨ Generate AI Plan"}
            </button>
          </div>
        </div>

        {/* Global Stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, animation: "fade-in 0.4s ease-out" }}>
          <StatCard label="Due Cards" icon="⏰" value={dueCount} glow={dueCount > 0 ? C.error : C.secondary} />
          <StatCard label="Avg Accuracy" icon="🎯" value={`${Math.round(overallAccuracy)}%`} glow={overallAccuracy > 75 ? C.secondary : C.tertiary} />
          <StatCard label="Micro Sessions" icon="⚡" value={microToday} glow={C.primary} />
          <StatCard label="Total Practice (Min)" icon="⏱" value={totalMicroMin} glow={C.tertiary} />
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
                      Your accuracy in <strong style={{color: C.tertiary}}>{topWeak.topic}</strong> is struggling (<span style={{color: C.error}}>{topWeak.score}%</span>). We added 5 priority cards to your revision queue.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Activity Timeline */}
            <div style={{ ...glass({ padding: "24px" }) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: C.textPrimary, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>📅 Today's Timeline</div>
                {planItems.length > 0 && <div style={{ fontSize: 11, color: C.textMuted }}>{doneCount} / {planItems.length} Completed</div>}
              </div>

              {planItems.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: C.textMuted }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13 }}>Timeline is empty. Generate a plan!</div>
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
                           <span style={{ fontSize: 13, fontWeight: 700, color: done ? C.textMuted : C.textPrimary, textDecoration: done ? "line-through" : "none" }}>{item.topic}</span>
                         </div>
                         {item.detail && <div style={{ fontSize: 11, color: C.textMuted }}>{item.detail}</div>}
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
                       <span style={{ fontSize: 11, fontWeight: 700, color: w.score < 50 ? C.error : C.tertiary }}>{w.score}%</span>
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