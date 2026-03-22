import { useState, useEffect } from "react";
import { getTodayPlan, generatePlan, getSrsStats, DEMO_USER } from "../lib/api";

const CARD_STYLE = {
  background: "#111829", border: "1px solid #1a2840",
  borderRadius: 12, padding: "18px 20px",
};

function StatCard({ label, value, color, note }) {
  return (
    <div style={{ ...CARD_STYLE, flex: 1 }}>
      <div style={{ fontSize: 11, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || "#e8eaf6", margin: "4px 0 2px", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#4a5a80" }}>{note}</div>
    </div>
  );
}

const TYPE_COLORS = {
  NEW:      { bg: "#7c6fff22", color: "#7c6fff" },
  REVISE:   { bg: "#ffd16622", color: "#ffd166" },
  PRACTICE: { bg: "#00e5a022", color: "#00e5a0" },
  BREAK:    { bg: "#ff6b9d22", color: "#ff6b9d" },
};

// Fallback demo plan shown while backend isn't ready
const DEMO_PLAN = [
  { time: "08:00 AM", type: "NEW",      topic: "Modern Physics — Photoelectric Effect", detail: "JEE high-priority · 45 min" },
  { time: "10:00 AM", type: "REVISE",   topic: "Thermodynamics",                        detail: "Retention: 38% — due now · 20 min" },
  { time: "11:30 AM", type: "PRACTICE", topic: "Newton's Laws — MCQ Drill",             detail: "10 PYQ-style questions · 30 min" },
  { time: "02:00 PM", type: "NEW",      topic: "Chemical Bonding — VSEPR Theory",       detail: "NCERT + JD Lee · 45 min" },
  { time: "04:00 PM", type: "REVISE",   topic: "Electrostatics",                        detail: "Retention: 51% — upcoming · 20 min" },
  { time: "05:30 PM", type: "PRACTICE", topic: "Organic Reactions — Weak Area Drill",   detail: "AI-detected weakness · 30 min" },
  { time: "08:00 PM", type: "REVISE",   topic: "Cell Division",                         detail: "Light evening revision · 15 min" },
];

export default function Dashboard() {
  const [plan, setPlan]       = useState(DEMO_PLAN);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState({});
  const [stats, setStats]     = useState({ due: 7, total: 42, avg: 68, streak: 3 });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generatePlan(DEMO_USER);
      if (res.data?.plan) setPlan(res.data.plan);
    } catch {
      // backend not ready yet — keep demo plan, that's fine
    }
    setLoading(false);
  };

  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            Good morning, Radhika 👋
          </h1>
          <p style={{ color: "#4a5a80", fontSize: 13, marginTop: 4 }}>
            Based on your performance — 3 topics need revision today.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            background: "#7c6fff", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 20px", fontSize: 13,
            fontWeight: 600, cursor: "pointer",
          }}
        >
          {loading ? "Generating…" : "✨ Generate AI Plan"}
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        <StatCard label="Due Now"      value={stats.due}      color="#ff4d6d" note="revision needed" />
        <StatCard label="Total Topics" value={stats.total}    color={null}    note="being tracked" />
        <StatCard label="Avg Retention" value={`${stats.avg}%`} color="#ffd166" note="memory health" />
        <StatCard label="Day Streak"   value={stats.streak}   color="#00e5a0" note="🔥 keep going!" />
      </div>

      {/* Progress bar */}
      <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>Today's Progress</span>
          <span style={{ fontSize: 12, color: "#00e5a0", fontFamily: "monospace" }}>
            {doneCount}/{plan.length} tasks
          </span>
        </div>
        <div style={{ height: 8, background: "#1a2840", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4, background: "#00e5a0",
            width: `${(doneCount / plan.length) * 100}%`, transition: "width 0.4s"
          }} />
        </div>
      </div>

      {/* Daily plan */}
      <div style={{ ...CARD_STYLE }}>
        <div style={{ fontSize: 13, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          📅 Today's Study Plan
        </div>

        {plan.map((item, i) => {
          const tc = TYPE_COLORS[item.type] || TYPE_COLORS.NEW;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "11px 14px", background: "#0d1526",
              borderRadius: 8, marginBottom: 8,
              border: "1px solid #1a2840",
              opacity: done[i] ? 0.45 : 1, transition: "opacity 0.3s",
            }}>
              <div style={{ fontSize: 11, color: "#4a5a80", fontFamily: "monospace", minWidth: 74 }}>
                {item.time}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px",
                  borderRadius: 4, letterSpacing: 0.5,
                  background: tc.bg, color: tc.color, marginBottom: 4, display: "inline-block"
                }}>{item.type}</span>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4, textDecoration: done[i] ? "line-through" : "none" }}>
                  {item.topic}
                </div>
                <div style={{ fontSize: 11, color: "#4a5a80", marginTop: 2 }}>{item.detail}</div>
              </div>
              <div
                style={{ cursor: "pointer", fontSize: 18, color: done[i] ? "#00e5a0" : "#4a5a80" }}
                onClick={() => setDone(p => ({ ...p, [i]: !p[i] }))}
              >
                {done[i] ? "✅" : "○"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Memory health */}
      <div style={{ ...CARD_STYLE, marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          🧠 Memory Health — Forgetting Predictions
        </div>
        {[
          { topic: "Thermodynamics",   pct: 38, warn: "⚠️ Forget in ~6 hours" },
          { topic: "Electrostatics",   pct: 51, warn: "⏱ Forget in ~18 hours" },
          { topic: "Organic Chemistry",pct: 63, warn: "📅 Forget in ~2 days" },
          { topic: "Cell Division",    pct: 82, warn: "✅ Memory strong" },
        ].map((r, i) => {
          const col = r.pct < 50 ? "#ff4d6d" : r.pct < 70 ? "#ffd166" : "#00e5a0";
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13 }}>{r.topic}</span>
                <span style={{ fontSize: 11, color: col }}>{r.warn}</span>
              </div>
              <div style={{ height: 5, background: "#1a2840", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: col, width: `${r.pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}