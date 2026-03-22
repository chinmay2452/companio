import { useState, useEffect, useRef } from "react";

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

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];

const FLASHCARDS = [
  { q: "First Law of Thermodynamics?",  a: "ΔU = Q − W (Energy cannot be created or destroyed)",  subject: "Physics" },
  { q: "What is Coulomb's Law?",         a: "F = kq₁q₂/r² — force between two charges",            subject: "Physics" },
  { q: "sp³ hybridisation example?",    a: "Methane (CH₄) — tetrahedral, 109.5° bond angle",       subject: "Chemistry" },
  { q: "Avogadro's Number?",            a: "6.022 × 10²³ particles per mole",                       subject: "Chemistry" },
  { q: "What is mitosis?",              a: "Cell division producing 2 identical daughter cells",    subject: "Biology" },
];

const QUICK_MCQS = [
  { q: "KE of 2 kg body at 10 m/s?",    opts: ["100 J","50 J","200 J","25 J"],          ans: "100 J"   },
  { q: "SI unit of electric charge?",   opts: ["Volt","Coulomb","Ampere","Ohm"],         ans: "Coulomb" },
  { q: "Photosynthesis equation?",       opts: ["6CO₂+6H₂O→C₆H₁₂O₆+6O₂","C+O₂→CO₂","H₂+O→H₂O","None"], ans: "6CO₂+6H₂O→C₆H₁₂O₆+6O₂" },
];

/* ── Duration options ───────────────────────────────────────────── */
const DURATIONS = [
  { mins: 5,  emoji: "⚡", desc: "Quick burst",    badge: "Fast",        badgeColor: C.textMuted,  glow: null },
  { mins: 10, emoji: "🎯", desc: "Focused",        badge: "Popular",     badgeColor: C.secondary,  glow: C.secondary },
  { mins: 15, emoji: "📘", desc: "Deep focus",     badge: "Solid",       badgeColor: "#4a9eff",    glow: null },
  { mins: 20, emoji: "🔥", desc: "Power session",  badge: "Recommended", badgeColor: C.tertiary,   glow: C.primary, recommended: true },
  { mins: 30, emoji: "🧠", desc: "Intensive",      badge: "Pro",         badgeColor: C.primary,    glow: null },
  { mins: 45, emoji: "🏆", desc: "Deep work",      badge: "Elite",       badgeColor: "#ffb84d",    glow: null },
];

/* ── Stat card ──────────────────────────────────────────────────── */
function StatChip({ icon, label, value, glow }) {
  return (
    <div style={{
      ...glass({ padding: "12px 16px", flex: 1, position: "relative", overflow: "hidden" }),
      boxShadow: `0 0 18px ${glow}18`,
    }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 40, height: 40, borderRadius: "50%", background: glow, opacity: 0.1, filter: "blur(14px)" }} />
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: glow, fontFamily: "Manrope,sans-serif" }}>{value}</div>
    </div>
  );
}

/* ── Duration card ──────────────────────────────────────────────── */
function DurationCard({ dur, selected, onSelect, idx }) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected === dur.mins;
  const glowColor = dur.glow || C.primary;

  return (
    <div
      onClick={() => onSelect(dur.mins)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", padding: "20px 16px", borderRadius: 14, cursor: "pointer",
        textAlign: "center", transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        background: isActive
          ? `linear-gradient(135deg,${C.primaryDim}22,${C.primary}10)`
          : hovered ? C.surfaceHi : C.surface,
        border: isActive
          ? `1px solid ${C.primary}77`
          : hovered ? `1px solid ${C.outline}88` : `1px solid ${C.outline}33`,
        boxShadow: isActive
          ? `0 0 28px ${glowColor}28, inset 0 0 16px ${glowColor}08`
          : hovered ? `0 6px 20px rgba(0,0,0,0.35)` : "none",
        transform: hovered && !isActive ? "translateY(-4px)" : "none",
        animation: `card-in 0.35s ease ${idx * 0.04}s both`,
      }}
    >
      {/* Recommended badge + glow */}
      {dur.recommended && (
        <div style={{
          position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
          fontSize: 9, fontWeight: 800, color: C.primaryDim,
          background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: 0.5, textTransform: "uppercase",
          border: `1px solid ${C.primary}55`, borderRadius: "0 0 8px 8px", padding: "1px 10px",
        }}>
          ⚡ Recommended
        </div>
      )}

      {/* Duration badge (top-right) */}
      <div style={{
        position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 700,
        color: dur.badgeColor, background: `${dur.badgeColor}18`,
        border: `1px solid ${dur.badgeColor}33`, borderRadius: 10, padding: "2px 7px",
      }}>
        {dur.badge}
      </div>

      {/* Time number */}
      <div style={{
        fontSize: 32, fontWeight: 800, color: isActive ? C.primary : C.textPrimary,
        fontFamily: "Manrope,sans-serif", letterSpacing: -1, lineHeight: 1,
        marginTop: dur.recommended ? 10 : 0, marginBottom: 2,
        transition: "color 0.2s",
      }}>
        {dur.mins}
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>min</div>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{dur.emoji}</div>
      <div style={{ fontSize: 11, color: hovered || isActive ? C.textPrimary : C.textMuted, fontWeight: 500, transition: "color 0.2s" }}>
        {dur.desc}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function MicroTimePage() {
  const [selectedMins, setSelectedMins] = useState(null);
  const [timeLeft,     setTimeLeft]     = useState(0);
  const [active,       setActive]       = useState(false);
  const [phase,        setPhase]        = useState("idle"); // idle | flashcard | mcq | done
  const [fcIdx,        setFcIdx]        = useState(0);
  const [flipped,      setFlipped]      = useState(false);
  const [mcqIdx,       setMcqIdx]       = useState(0);
  const [mcqSelected,  setMcqSelected]  = useState(null);
  const [streak,       setStreak]       = useState(3);
  const [sessionsToday,setSessionsToday]= useState(3);
  const [totalTime,    setTotalTime]    = useState(47);
  const [subject,      setSubject]      = useState("Physics");
  const [topic,        setTopic]        = useState("");
  const timerRef = useRef(null);

  const startSession = (mins) => {
    const m = mins || selectedMins;
    if (!m) return;
    setTimeLeft(m * 60);
    setActive(true);
    setPhase("flashcard");
    setFcIdx(0); setFlipped(false);
    setMcqIdx(0); setMcqSelected(null);
  };

  useEffect(() => {
    if (!active) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setActive(false); setPhase("done"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [active]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const progressPct = selectedMins ? Math.round(((selectedMins * 60 - timeLeft) / (selectedMins * 60)) * 100) : 0;
  const fc  = FLASHCARDS[fcIdx % FLASHCARDS.length];
  const mcq = QUICK_MCQS[mcqIdx % QUICK_MCQS.length];

  /* ── Done screen ─────────────────────────────────────────────── */
  if (phase === "done") {
    return (
      <>
        <style>{`@keyframes card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}} @keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: "Inter,sans-serif" }}>
          <div style={{ ...glass({ padding: "48px 40px", textAlign: "center", maxWidth: 420 }), border: `1px solid ${C.secondary}44`, animation: "fade-in 0.4s ease" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.secondary, fontFamily: "Manrope,sans-serif", margin: "0 0 8px" }}>Session Complete!</h2>
            <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, margin: "0 0 4px" }}>
              Streak: <strong style={{ color: C.tertiary }}>🔥 {streak + 1} days</strong>
            </p>
            <p style={{ color: C.textMuted, fontSize: 12, margin: "0 0 24px" }}>Your revision data has been saved.</p>
            <button
              onClick={() => { setPhase("idle"); setSelectedMins(null); setStreak(s => s + 1); setSessionsToday(s => s + 1); setTotalTime(t => t + (selectedMins || 0)); }}
              style={{
                background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff",
                border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px ${C.primary}44`,
              }}
            >⚡ Start Another Session</button>
          </div>
        </div>
      </>
    );
  }

  /* ── Active session ──────────────────────────────────────────── */
  if (active) {
    return (
      <>
        <style>{`@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} @keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
        <div style={{ padding: "24px 28px", maxWidth: 640, margin: "0 auto", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>

          {/* Timer header */}
          <div style={{ ...glass({ padding: "20px 24px", marginBottom: 20, textAlign: "center" }), border: `1px solid ${C.primary}33` }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>⏱ Time Remaining</div>
            <div style={{ fontSize: 58, fontWeight: 800, color: C.secondary, fontFamily: "Manrope,sans-serif", letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>
              {mm}:{ss}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>{selectedMins}-minute power session · {subject}</div>
            <div style={{ height: 6, background: C.surfaceTop, borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
              <div style={{
                height: "100%", width: `${progressPct}%`, borderRadius: 3, transition: "width 1s linear",
                background: `linear-gradient(90deg,${C.primaryDim},${C.primary},${C.secondary})`,
                boxShadow: `0 0 10px ${C.primary}66`,
              }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => { clearInterval(timerRef.current); setActive(false); }}
                style={{ background: C.surfaceTop, color: C.textMuted, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >Pause</button>
              <button
                onClick={() => { clearInterval(timerRef.current); setActive(false); setPhase("done"); }}
                style={{ background: `${C.error}18`, color: C.error, border: `1px solid ${C.error}33`, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >End Session</button>
            </div>
          </div>

          {/* Tab switch */}
          <div style={{ display: "flex", gap: 6, background: C.surfaceTop, borderRadius: 10, padding: 3, marginBottom: 16 }}>
            {["flashcard", "mcq"].map(p => (
              <button key={p} onClick={() => setPhase(p)} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                background: phase === p ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : "transparent",
                color: phase === p ? "#fff" : C.textMuted,
              }}>
                {p === "flashcard" ? "🃏 Flashcards" : "✏️ Quick MCQ"}
              </button>
            ))}
          </div>

          {/* Flashcard */}
          {phase === "flashcard" && (
            <div style={{ animation: "fade-in 0.3s ease" }}>
              <div
                onClick={() => setFlipped(p => !p)}
                style={{
                  ...glass({ padding: "36px 28px", textAlign: "center", cursor: "pointer", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 12 }),
                  border: flipped ? `1px solid ${C.primary}55` : `1px solid ${C.outline}33`,
                  background: flipped ? `linear-gradient(135deg,${C.primary}08,${C.primaryDim}04)` : "rgba(15,25,46,0.85)",
                  boxShadow: flipped ? `0 0 28px ${C.primary}18` : "none",
                  transition: "all 0.3s",
                }}
              >
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12 }}>
                  {flipped ? "Answer — tap to flip back" : "Question — tap to reveal"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: flipped ? C.primary : C.textPrimary }}>
                  {flipped ? fc.a : fc.q}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>{fc.subject}</div>
              </div>
              <button
                onClick={() => { setFcIdx(i => i + 1); setFlipped(false); }}
                style={{ width: "100%", background: C.surfaceTop, border: `1px solid ${C.outline}33`, borderRadius: 10, padding: "11px", fontSize: 13, color: C.textMuted, cursor: "pointer" }}
              >Next Card →</button>
            </div>
          )}

          {/* MCQ */}
          {phase === "mcq" && (
            <div style={{ animation: "fade-in 0.3s ease" }}>
              <div style={{ ...glass({ padding: "20px 22px", marginBottom: 12 }) }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, lineHeight: 1.6 }}>{mcq.q}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {mcq.opts.map((opt, i) => {
                    let bg = C.surfaceTop, border = `1px solid ${C.outline}33`, color = C.textPrimary;
                    if (mcqSelected) {
                      if (opt === mcq.ans)    { bg = `${C.secondary}12`; border = `1px solid ${C.secondary}55`; color = C.secondary; }
                      else if (opt === mcqSelected) { bg = `${C.error}12`; border = `1px solid ${C.error}55`; color = C.error; }
                      else { color = C.textMuted; }
                    }
                    return (
                      <div key={i} onClick={() => !mcqSelected && setMcqSelected(opt)} style={{ padding: "11px 14px", borderRadius: 9, border, background: bg, color, cursor: mcqSelected ? "default" : "pointer", fontSize: 13, transition: "all 0.2s" }}>
                        <span style={{ marginRight: 10, fontWeight: 700, fontFamily: "monospace" }}>{String.fromCharCode(65 + i)}.</span>{opt}
                      </div>
                    );
                  })}
                </div>
              </div>
              {mcqSelected && (
                <button
                  onClick={() => { setMcqIdx(i => i + 1); setMcqSelected(null); }}
                  style={{ width: "100%", background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >Next Question →</button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── Selection screen ─────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes card-in  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes fade-in   { from{opacity:0;transform:translateY(6px)}  to{opacity:1;transform:none} }
        @keyframes lightning { 0%,100%{opacity:.7} 50%{opacity:1;filter:drop-shadow(0 0 4px ${C.primary})} }
        .dur-card { cursor:pointer; }
        .cta-btn:hover { filter:brightness(1.12); transform:scale(1.02); }
      `}</style>

      <div style={{
        padding: "24px 28px", fontFamily: "Inter,sans-serif", color: C.textPrimary,
        maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0 }}>
              ⚡ Micro Learn
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "5px 0 0" }}>
              High-impact study sessions for when time is short
            </p>
          </div>
          <div style={{ ...glass({ padding: "8px 16px" }), display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 16, animation: "lightning 2s ease-in-out infinite" }}>🔥</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.tertiary, fontFamily: "Manrope,sans-serif" }}>{streak} Day Streak</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>Keep it going!</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12 }}>
          <StatChip icon="🎯" label="Sessions Today" value={sessionsToday}         glow={C.secondary} />
          <StatChip icon="⏱" label="Total Time"      value={`${totalTime}m`}       glow={C.primary}   />
          <StatChip icon="🏆" label="Best Streak"     value={`${streak + 1} days`}  glow={C.tertiary}  />
        </div>

        {/* Inline config row */}
        <div style={{ ...glass({ padding: "14px 18px" }), display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Subject</div>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ width: "100%", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, padding: "9px 12px", outline: "none", cursor: "pointer" }}
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.5 }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Topic (optional)</div>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Newton's Laws, Photosynthesis…"
              style={{ width: "100%", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, padding: "9px 12px", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Duration selection */}
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 14 }}>
            Choose Your Session Length
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {DURATIONS.map((dur, idx) => (
              <DurationCard
                key={dur.mins}
                dur={dur}
                selected={selectedMins}
                onSelect={setSelectedMins}
                idx={idx}
              />
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          className="cta-btn"
          onClick={() => startSession()}
          disabled={!selectedMins}
          style={{
            width: "100%", padding: "15px", borderRadius: 12, border: "none",
            cursor: selectedMins ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 800,
            fontFamily: "Manrope,sans-serif", letterSpacing: -0.3,
            background: selectedMins
              ? `linear-gradient(135deg,${C.primary},${C.primaryDim})`
              : C.surfaceTop,
            color: selectedMins ? "#fff" : C.textMuted,
            boxShadow: selectedMins ? `0 6px 28px ${C.primary}44` : "none",
            transition: "all 0.2s",
          }}
        >
          {selectedMins
            ? `⚡ Start ${selectedMins} min Session`
            : "Select a duration above"
          }
        </button>

        {/* Info strip */}
        <div style={{ ...glass({ padding: "14px 18px" }), display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 22 }}>💡</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, marginBottom: 3 }}>Why Micro Sessions Work</div>
            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
              Students using Micro Mode while commuting or during breaks retain 40% more. Even 5 minutes of spaced revision dramatically reduces the forgetting curve.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}