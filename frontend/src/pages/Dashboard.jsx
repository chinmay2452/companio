import { useState, useEffect } from "react";
import { getTodayPlan, generatePlan, getUserStats } from "../lib/api";
import useAppStore from "../store/useAppStore";

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

const EXAM_OPTIONS = ["JEE", "NEET", "UPSC"];

const EXAM_SUBJECTS = {
  JEE: ["Physics", "Chemistry", "Maths"],
  NEET: ["Physics", "Chemistry", "Biology"],
  UPSC: ["History", "Geography", "Polity", "Economy", "Science"],
};

export default function Dashboard() {
  const user = useAppStore((s) => s.user);
  const userId = user?.id || "demo-user-001";
  const userName = user?.name || "Student";
  const storeExamType = useAppStore((s) => s.examType) || "JEE";

  const [plan, setPlan]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState({});
  const [stats, setStats]           = useState({ due: 0, total: 0, avg: 0, streak: 0 });
  const [examType, setExamType]     = useState(storeExamType);
  const [hours, setHours]           = useState(6);
  const [showConfig, setShowConfig] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);

  // New states for User Preferences
  const [selectedSubjects, setSelectedSubjects] = useState(EXAM_SUBJECTS[storeExamType] || []);
  const [topicsFocus, setTopicsFocus] = useState("");

  // Update selected subjects if examType changes
  useEffect(() => {
    setSelectedSubjects(EXAM_SUBJECTS[examType] || []);
  }, [examType]);

  // Load today's plan on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getTodayPlan(userId);
        if (res.data?.plan && Array.isArray(res.data.plan) && res.data.plan.length > 0) {
          setPlan(res.data.plan);
          setPlanLoaded(true);
        }
      } catch {
        // no saved plan yet
      }

      // Fetch stats
      try {
        const statsRes = await getUserStats(userId);
        if (statsRes.data) {
          setStats({
            due: statsRes.data.cards_due_today ?? statsRes.data.total_cards ?? 0,
            total: statsRes.data.total_cards ?? 0,
            avg: statsRes.data.avg_score ? Math.round(statsRes.data.avg_score * 20) : 0,
            streak: statsRes.data.streak ?? 0,
          });
        }
      } catch {
        // stats fetch failed, keep defaults
      }
    })();
  }, [userId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generatePlan(userId, examType, hours, null, selectedSubjects, topicsFocus);
      if (res.data?.plan) {
        const planData = Array.isArray(res.data.plan) ? res.data.plan : [];
        // Normalize: ensure each item has the keys the UI needs
        const normalized = planData.map((item, i) => ({
          time: item.time || item.time_slot || `${8 + i}:00 AM`,
          type: (item.type || item.activity || "NEW").toUpperCase(),
          topic: item.topic || item.subject || "Study session",
          detail: item.detail || item.reason || `${item.duration_min || 30} min · ${item.priority || "medium"} priority`,
          subject: item.subject || "",
          duration_min: item.duration_min || 30,
          priority: item.priority || "medium",
        }));
        setPlan(normalized);
        setPlanLoaded(true);
        setDone({});
        setShowConfig(false); // hide config after generating
      }
    } catch (err) {
      console.error("Plan generation failed:", err);
    }
    setLoading(false);
  };

  const toggleSubject = (subj) => {
    setSelectedSubjects(prev =>
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    );
  };

  const doneCount = Object.values(done).filter(Boolean).length;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            {greeting}, {userName} 👋
          </h1>
          <p style={{ color: "#4a5a80", fontSize: 13, marginTop: 4 }}>
            {planLoaded
              ? `Your ${examType} study plan is ready — ${plan.length} sessions scheduled.`
              : `Click "Generate AI Plan" to create your ${examType} study schedule.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: showConfig ? "#233352" : "#1a2840", color: "#e8eaf6", border: "1px solid #1a2840",
              borderRadius: 8, padding: "10px 14px", fontSize: 13,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            ⚙️ Configuration
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              background: loading ? "#4a5a80" : "#7c6fff", color: "#fff", border: "none",
              borderRadius: 8, padding: "10px 20px", fontSize: 13,
              fontWeight: 600, cursor: loading ? "wait" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "⏳ Generating…" : "✨ Generate AI Plan"}
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div style={{ ...CARD_STYLE, marginBottom: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Exam Type
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {EXAM_OPTIONS.map(e => (
                  <button key={e} onClick={() => setExamType(e)} style={{
                    padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: examType === e ? "1px solid #7c6fff" : "1px solid #1a2840",
                    background: examType === e ? "#7c6fff22" : "#0d1526",
                    color: examType === e ? "#7c6fff" : "#4a5a80",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Available Hours
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {[3, 4, 6, 8, 10].map(h => (
                  <button key={h} onClick={() => setHours(h)} style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: hours === h ? "1px solid #00e5a0" : "1px solid #1a2840",
                    background: hours === h ? "#00e5a022" : "#0d1526",
                    color: hours === h ? "#00e5a0" : "#4a5a80",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: "#1a2840" }} />

          <div>
            <label style={{ fontSize: 11, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Subjects for Today
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(EXAM_SUBJECTS[examType] || []).map(subj => {
                const isSelected = selectedSubjects.includes(subj);
                return (
                  <button key={subj} onClick={() => toggleSubject(subj)} style={{
                    padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: isSelected ? "1px solid #ffd166" : "1px solid #1a2840",
                    background: isSelected ? "#ffd16622" : "#0d1526",
                    color: isSelected ? "#ffd166" : "#4a5a80",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {isSelected ? "✓" : "+"} {subj}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Specific Topics Focus (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Rotational Mechanics, Thermodynamics..."
              value={topicsFocus}
              onChange={(e) => setTopicsFocus(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", background: "#0d1526",
                border: "1px solid #1a2840", borderRadius: 6, color: "#e8eaf6",
                fontSize: 13, outline: "none", transition: "border 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#7c6fff"}
              onBlur={(e) => e.target.style.borderColor = "#1a2840"}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        <StatCard label="Due Now"       value={stats.due}         color="#ff4d6d" note="revision needed" />
        <StatCard label="Total Topics"  value={stats.total}       color={null}    note="being tracked" />
        <StatCard label="Avg Retention" value={`${stats.avg}%`}   color="#ffd166" note="memory health" />
        <StatCard label="Day Streak"    value={stats.streak}      color="#00e5a0" note="🔥 keep going!" />
      </div>

      {/* Progress bar */}
      {plan.length > 0 && (
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
      )}

      {/* Daily plan */}
      <div style={{ ...CARD_STYLE }}>
        <div style={{ fontSize: 13, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          📅 Today's Study Plan {plan.length > 0 && <span style={{ color: "#7c6fff", fontSize: 10, marginLeft: 8 }}>AI-Generated</span>}
        </div>

        {plan.length === 0 && !loading && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "#4a5a80", fontSize: 14,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ marginBottom: 8 }}>No study plan for today yet</div>
            <div style={{ fontSize: 12 }}>
              Click <strong style={{ color: "#e8eaf6" }}>⚙️ Configuration</strong> to set subjects, then <strong style={{ color: "#7c6fff" }}>Generate AI Plan</strong>
            </div>
          </div>
        )}

        {loading && (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "#7c6fff", fontSize: 14,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⚡</div>
            <div>AI is analyzing your focus topics and creating a personalised plan...</div>
          </div>
        )}

        {!loading && plan.map((item, i) => {
          const typeStr = (item.type || "NEW").toUpperCase();
          const tc = TYPE_COLORS[typeStr] || TYPE_COLORS.NEW;
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
                }}>{typeStr}</span>
                <span style={{ fontSize: 10, color: "#4a5a80", marginLeft: 8 }}>{item.subject}</span>
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

      {/* Memory health — now driven by weak topics from stats */}
      {plan.length > 0 && (
        <div style={{ ...CARD_STYLE, marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
            🧠 Study Focus Areas
          </div>
          {plan.filter(s => s.priority === "high" || (s.type || "").toUpperCase() === "REVISE").slice(0, 4).map((r, i) => {
            const pct = r.priority === "high" ? 35 + i * 12 : 60 + i * 10;
            const col = pct < 50 ? "#ff4d6d" : pct < 70 ? "#ffd166" : "#00e5a0";
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{r.topic}</span>
                  <span style={{ fontSize: 11, color: col }}>
                    {r.priority === "high" ? "⚠️ Needs attention" : "📅 Scheduled for review"}
                  </span>
                </div>
                <div style={{ height: 5, background: "#1a2840", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: col, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {plan.filter(s => s.priority === "high" || (s.type || "").toUpperCase() === "REVISE").length === 0 && (
            <div style={{ color: "#4a5a80", fontSize: 13, padding: "10px 0" }}>
              ✅ No high-priority topics — great job staying on track!
            </div>
          )}
        </div>
      )}
    </div>
  );
}