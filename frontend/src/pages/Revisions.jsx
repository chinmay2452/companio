import { useState, useEffect, useMemo } from "react";
import { getDueCards, getAllCards, createCard, deleteCard, clearAllData, reviewCard, getSrsStats } from "../lib/api";
import useAppStore from "../store/useAppStore";

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

const SCORES = [
  { val: 0, label: "Again",   color: C.error,     desc: "Blackout" },
  { val: 2, label: "Hard",    color: C.tertiary,  desc: "Familiar" },
  { val: 3, label: "Good",    color: C.primary,   desc: "Effort" },
  { val: 4, label: "Easy",    color: "#4a9eff",   desc: "Hesitation" },
  { val: 5, label: "Perfect", color: C.secondary, desc: "Instant" },
];

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
      ...glass({ padding: "16px 18px", flex: 1, position: "relative", overflow: "hidden" }),
      boxShadow: `0 0 24px ${glow}18`,
    }}>
      <div style={{ position: "absolute", top: -16, right: -16, width: 60, height: 60, borderRadius: "50%", background: glow, opacity: 0.09, filter: "blur(18px)" }} />
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: glow, fontFamily: "Manrope,sans-serif", letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Countdown helper ───────────────────────────────────────────── */
function formatCountdown(dueDate) {
  const diff = new Date(dueDate) - new Date();
  if (diff <= 0) return { label: "Due now", color: C.error, now: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return { label: `in ${m}m`, color: C.tertiary };
  if (h < 24)  return { label: `in ${h}h ${m}m`, color: C.tertiary };
  const d = Math.floor(h / 24);
  return { label: d === 1 ? "Tomorrow" : `in ${d} days`, color: C.textMuted };
}

/* ── Memory Health Bar ──────────────────────────────────────────── */
function MemoryHealthBar({ pct }) {
  const col = pct >= 75 ? C.secondary : pct >= 50 ? C.primary : C.tertiary;
  return (
    <div style={{ ...glass({ padding: "16px 20px", marginBottom: 16 }) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>🧠 Memory Health</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: col, fontFamily: "Manrope,sans-serif" }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: C.surfaceTop, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.8s ease",
          background: `linear-gradient(90deg,${C.primaryDim},${C.primary},${C.secondary})`,
          boxShadow: `0 0 10px ${C.primary}66`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {["Needs Work","Building","Good","Strong","Excellent"].map((l, i) => (
          <span key={i} style={{ fontSize: 10, color: C.outline }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Upcoming reviews list ──────────────────────────────────────── */
function UpcomingList({ cards, onStartReview }) {
  const sorted = useMemo(() =>
    [...cards].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 6),
    [cards]
  );

  return (
    <div style={{ ...glass({ padding: "18px 20px", marginBottom: 16 }) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>⏰ Upcoming Reviews</div>
        {cards.filter(c => new Date(c.due_date) <= new Date()).length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: C.error, background: `${C.error}18`, padding: "3px 10px", borderRadius: 20 }}>
            {cards.filter(c => new Date(c.due_date) <= new Date()).length} Due
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sorted.map((c, i) => {
          const cd = formatCountdown(c.due_date);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 10,
              borderLeft: cd.now ? `3px solid ${C.secondary}` : `3px solid transparent`,
              background: cd.now ? `${C.secondary}08` : "transparent",
              transition: "background 0.15s",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.primary, background: `${C.primary}18`, padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>
                {c.subject}
              </span>
              <span style={{ fontSize: 12, color: C.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.topic || c.front?.substring(0, 40) || "Card"}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: cd.color, flexShrink: 0 }}>{cd.label}</span>
              <span style={{ fontSize: 10, color: C.outline, flexShrink: 0 }}>{c.interval_days}d</span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: "14px 0" }}>
            No upcoming cards. Create some flashcards to get started!
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function Revisions() {
  const user   = useAppStore(s => s.user);
  const userId = user?.id;

  const [tab, setTab] = useState("review");

  // Review state
  const [dueCards,      setDueCards]      = useState([]);
  const [idx,           setIdx]           = useState(0);
  const [flipped,       setFlipped]       = useState(false);
  const [reviewLoading, setReviewLoading] = useState(true);

  // Manage state
  const [allCards,      setAllCards]      = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [formSubject,   setFormSubject]   = useState("Physics");
  const [formTopic,     setFormTopic]     = useState("");
  const [formFront,     setFormFront]     = useState("");
  const [formBack,      setFormBack]      = useState("");
  const [saving,        setSaving]        = useState(false);
  const [confirmClear,  setConfirmClear]  = useState(false);

  // Stats
  const [srsStats, setSrsStats] = useState({ avg_retention: 78, streak: 0, total: 0 });

  const loadDueCards = async () => {
    setReviewLoading(true);
    try {
      const res = await getDueCards(userId);
      setDueCards(res.data?.due_cards || []);
    } catch { setDueCards([]); }
    setIdx(0); setFlipped(false);
    setReviewLoading(false);
  };

  const loadAllCards = async () => {
    setManageLoading(true);
    try {
      const res = await getAllCards(userId);
      setAllCards(res.data?.cards || []);
    } catch { setAllCards([]); }
    setManageLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await getSrsStats(userId);
      if (res.data) setSrsStats({
        avg_retention: res.data.avg_score ? Math.round(res.data.avg_score * 20) : 78,
        streak:        res.data.streak ?? 0,
        total:         res.data.total_cards ?? 0,
      });
    } catch { /* keep defaults */ }
  };

  useEffect(() => { loadDueCards(); loadAllCards(); loadStats(); }, []);

  // ── Review handlers ───────────────────────────────────────────────
  const card     = dueCards[idx];
  const progress = dueCards.length > 0 ? Math.round((idx / dueCards.length) * 100) : 0;

  const handleScore = async (quality) => {
    try { await reviewCard(userId, card.id, quality); } catch {}
    setFlipped(false);
    setIdx(i => i + 1);
  };

  // ── Next review countdown ─────────────────────────────────────────
  const nextDue = useMemo(() => {
    const future = allCards
      .filter(c => new Date(c.due_date) > new Date())
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
    if (!future) return "No upcoming";
    return formatCountdown(future.due_date).label;
  }, [allCards]);

  // ── Manage handlers ───────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formTopic || !formFront || !formBack) return;
    setSaving(true);
    try {
      await createCard(userId, formSubject, formTopic, formFront, formBack);
      setFormTopic(""); setFormFront(""); setFormBack("");
      setShowForm(false);
      loadAllCards(); loadDueCards();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (cardId) => {
    try { await deleteCard(cardId); setAllCards(p => p.filter(c => c.id !== cardId)); loadDueCards(); }
    catch (e) { console.error(e); }
  };

  const handleClearAll = async () => {
    try { await clearAllData(userId); setAllCards([]); setDueCards([]); setIdx(0); setConfirmClear(false); }
    catch (e) { console.error(e); }
  };

  const memHealth = srsStats.avg_retention || 78;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes nebula-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes flip-reveal { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .score-btn:hover { transform: scale(1.04); }
        .cta-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
        .card-row:hover { background: ${C.surfaceHi} !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.outline}66; border-radius: 2px; }
      `}</style>

      <div style={{ padding: "24px 28px", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0 }}>
              🧠 Spaced Repetition
            </h1>
            <p style={{ color: C.textMuted, fontSize: 12, margin: "5px 0 0" }}>SM-2 algorithm — forgetting curve based revision scheduling</p>
          </div>
          {srsStats.streak > 0 && (
            <div style={{ ...glass({ padding: "8px 16px" }), display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.tertiary }}>{srsStats.streak} Day Streak</span>
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 3, background: C.surfaceTop, borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 24 }}>
          {[
            { key: "review", label: "📖 Review Cards", count: dueCards.length },
            { key: "manage", label: "⚙️ Manage Cards", count: allCards.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: tab === t.key ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : "transparent",
                color: tab === t.key ? "#fff" : C.textMuted,
                boxShadow: tab === t.key ? `0 2px 14px ${C.primary}44` : "none",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {t.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                background: tab === t.key ? "rgba(255,255,255,.2)" : C.surfaceTop,
                color: tab === t.key ? "#fff" : C.textMuted,
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ══════════════ REVIEW TAB ══════════════ */}
        {tab === "review" && (
          <div style={{ animation: "fade-in 0.3s ease" }}>
            {reviewLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 14 }}><Sk w="33%" h={90} r={14} /><Sk w="33%" h={90} r={14} /><Sk w="33%" h={90} r={14} /></div>
                <Sk h={70} r={14} />
                <Sk h={52} r={12} />
                <Sk h={220} r={14} />
              </div>
            ) : (
              <>
                {/* Stat cards */}
                <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                  <StatCard icon="📚" label="Cards Due"     value={dueCards.length}        sub={dueCards.length > 0 ? "Needs review today" : "All caught up!"}  glow={C.error}     />
                  <StatCard icon="🧠" label="Avg Retention" value={`${memHealth}%`}         sub="Memory health score"                                           glow={C.secondary} />
                  <StatCard icon="⏰" label="Next Review"   value={nextDue}                 sub="Upcoming scheduled"                                            glow={C.tertiary}  />
                </div>

                {/* Memory health */}
                <MemoryHealthBar pct={memHealth} />

                {/* Quick review CTA */}
                {dueCards.length > 0 && idx < dueCards.length && (
                  <button
                    className="cta-btn"
                    onClick={() => { setIdx(0); setFlipped(false); }}
                    style={{
                      width: "100%", padding: "14px", marginBottom: 16, border: "none", borderRadius: 12,
                      background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`,
                      color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
                      letterSpacing: -0.3, fontFamily: "Manrope,sans-serif",
                      boxShadow: `0 6px 24px ${C.primary}44`, transition: "all 0.2s",
                    }}
                  >
                    ⚡ Start Quick Review ({dueCards.length} cards)
                  </button>
                )}

                {/* Upcoming reviews */}
                <UpcomingList cards={allCards} onStartReview={() => setTab("review")} />

                {/* ── Active Review Session ─────────────────── */}
                {dueCards.length === 0 ? (
                  /* Empty state */
                  <div style={{ ...glass({ padding: "56px 40px" }), textAlign: "center", animation: "fade-in 0.4s ease" }}>
                    <div style={{ fontSize: 54, marginBottom: 16 }}>✅</div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: "Manrope,sans-serif", margin: "0 0 8px", color: C.secondary }}>
                      {allCards.length === 0 ? "No Flashcards Yet" : "All Caught Up!"}
                    </h3>
                    <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 360, margin: "0 auto 20px", lineHeight: 1.7 }}>
                      {allCards.length === 0
                        ? "You haven't created any flashcards. Go to Manage Cards to get started!"
                        : `All reviews done! Your next session is ${nextDue}. SM-2 intervals have been updated.`}
                    </p>
                    {allCards.length === 0 ? (
                      <button
                        className="cta-btn"
                        onClick={() => setTab("manage")}
                        style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                      >
                        ➕ Create Your First Card
                      </button>
                    ) : (
                      <div style={{ ...glass({ padding: "14px 20px", display: "inline-flex", alignItems: "center", gap: 10 }) }}>
                        <span style={{ fontSize: 22 }}>⏰</span>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 12, color: C.textMuted }}>Next Review</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: C.tertiary, fontFamily: "Manrope,sans-serif" }}>{nextDue}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : idx >= dueCards.length ? (
                  /* All reviewed */
                  <div style={{ ...glass({ padding: "52px 40px" }), textAlign: "center", border: `1px solid ${C.secondary}33`, animation: "fade-in 0.4s ease" }}>
                    <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: C.secondary, fontFamily: "Manrope,sans-serif", margin: "0 0 8px" }}>All Cards Reviewed!</h2>
                    <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 340, margin: "0 auto 24px", lineHeight: 1.7 }}>
                      Great session! SM-2 intervals have been updated based on your recall ratings.
                    </p>
                    <button
                      className="cta-btn"
                      onClick={() => { setIdx(0); setFlipped(false); loadDueCards(); }}
                      style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                    >
                      🔄 Restart Session
                    </button>
                  </div>
                ) : (
                  /* Active session */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Progress bar */}
                    <div style={{ ...glass({ padding: "14px 18px" }) }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: `${C.primary}18`, padding: "3px 10px", borderRadius: 6 }}>
                          Card {idx + 1} of {dueCards.length}
                        </span>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{dueCards.length - idx} remaining · {progress}%</span>
                      </div>
                      <div style={{ height: 7, background: C.surfaceTop, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${progress}%`, borderRadius: 4, transition: "width 0.5s ease",
                          background: `linear-gradient(90deg,${C.primaryDim},${C.primary},${C.secondary})`,
                          boxShadow: `0 0 10px ${C.primary}66`,
                        }} />
                      </div>
                    </div>

                    {/* Flip card */}
                    <div
                      onClick={() => setFlipped(p => !p)}
                      style={{
                        ...glass({
                          padding: "36px 32px", minHeight: 200,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", textAlign: "center", transition: "all 0.3s",
                          borderRadius: 16,
                        }),
                        border: flipped ? `1px solid ${C.primary}44` : `1px solid ${C.outline}33`,
                        boxShadow: flipped ? `0 0 32px ${C.primary}18` : "none",
                        background: flipped
                          ? "linear-gradient(135deg,rgba(171,163,255,.06),rgba(109,95,239,.04))"
                          : "rgba(15,25,46,0.85)",
                      }}
                    >
                      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 16, fontWeight: 700 }}>
                        {flipped ? "Answer — tap to flip back" : "Question — tap to reveal answer"}
                      </div>

                      {!flipped ? (
                        <>
                          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.6, color: C.textPrimary, marginBottom: 14 }}>{card.front}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: `${C.primary}18`, color: C.primary }}>{card.subject}</span>
                            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: C.surfaceTop, color: C.textMuted }}>{card.topic}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ animation: "flip-reveal 0.25s ease" }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: C.primary, lineHeight: 1.6, marginBottom: 6 }}>{card.back}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>Rate your recall below ↓</div>
                        </div>
                      )}
                    </div>

                    {/* Score buttons */}
                    {flipped ? (
                      <div style={{ animation: "fade-in 0.25s ease" }}>
                        <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginBottom: 10 }}>How well did you remember?</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                          {SCORES.map(sc => (
                            <button
                              key={sc.val}
                              className="score-btn"
                              onClick={() => handleScore(sc.val)}
                              style={{
                                padding: "12px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                                background: `${sc.color}12`, border: `1px solid ${sc.color}33`,
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 800, color: sc.color, fontFamily: "Manrope,sans-serif" }}>{sc.label}</div>
                              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{sc.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: 12, color: C.textMuted }}>
                        👆 Tap the card to reveal the answer
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════ MANAGE TAB ══════════════ */}
        {tab === "manage" && (
          <div style={{ animation: "fade-in 0.3s ease" }}>
            {/* Action bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>
                📚 Your Flashcards ({allCards.length})
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="cta-btn"
                  onClick={() => setShowForm(!showForm)}
                  style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                >
                  ➕ Add Card
                </button>
                {allCards.length > 0 && (
                  <button
                    onClick={() => setConfirmClear(true)}
                    style={{ background: `${C.error}15`, color: C.error, border: `1px solid ${C.error}33`, borderRadius: 9, padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    🗑️ Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Confirm clear */}
            {confirmClear && (
              <div style={{ ...glass({ padding: "18px 20px", marginBottom: 16 }), border: `1px solid ${C.error}44`, animation: "fade-in 0.2s ease" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.error}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.error, marginBottom: 6 }}>Delete ALL data permanently?</div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
                      This will remove all flashcards, attempts, study plans and analytics. Cannot be undone.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleClearAll} style={{ background: C.error, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Yes, Delete Everything
                      </button>
                      <button onClick={() => setConfirmClear(false)} style={{ background: C.surfaceTop, color: C.textMuted, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add Card Form */}
            {showForm && (
              <div style={{ ...glass({ padding: "20px 22px", marginBottom: 16 }), border: `1px solid ${C.primary}33`, animation: "fade-in 0.25s ease" }}>
                <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 14 }}>New Flashcard</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Subject</div>
                    <select value={formSubject} onChange={e => setFormSubject(e.target.value)} style={{ width: "100%", padding: "9px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none" }}>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Topic</div>
                    <input value={formTopic} onChange={e => setFormTopic(e.target.value)} placeholder="e.g. Thermodynamics" style={{ width: "100%", padding: "9px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Front (Question)</div>
                  <textarea value={formFront} onChange={e => setFormFront(e.target.value)} rows={2} placeholder="What is the first law of thermodynamics?" style={{ width: "100%", padding: "9px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Back (Answer)</div>
                  <textarea value={formBack} onChange={e => setFormBack(e.target.value)} rows={2} placeholder="Energy cannot be created or destroyed. ΔU = Q − W" style={{ width: "100%", padding: "9px 12px", background: C.surfaceTop, border: "none", borderRadius: 8, color: C.textPrimary, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="cta-btn"
                    onClick={handleCreate}
                    disabled={saving || !formTopic || !formFront || !formBack}
                    style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving || !formTopic || !formFront || !formBack ? 0.5 : 1, transition: "all 0.2s" }}
                  >
                    {saving ? "Saving…" : "💾 Save Card"}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ background: C.surfaceTop, color: C.textMuted, border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Cards list */}
            {manageLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3].map(i => <Sk key={i} h={80} r={12} />)}
              </div>
            ) : allCards.length === 0 ? (
              <div style={{ ...glass({ padding: "52px 40px" }), textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "Manrope,sans-serif", margin: "0 0 8px" }}>No Flashcards Yet</h3>
                <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 320, margin: "0 auto" }}>Create flashcards to start spaced repetition practice. Click "Add Card" above.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allCards.map((c, i) => {
                  const isDue = new Date(c.due_date) <= new Date();
                  return (
                    <div
                      key={c.id}
                      className="card-row"
                      style={{
                        ...glass({ padding: "14px 18px", borderRadius: 12 }),
                        display: "flex", alignItems: "flex-start", gap: 14, transition: "background 0.15s",
                        borderLeft: isDue ? `3px solid ${C.error}` : `3px solid ${C.outline}33`,
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: C.surfaceTop, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.textMuted, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${C.primary}18`, color: C.primary }}>{c.subject}</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: C.surfaceTop, color: C.textMuted }}>{c.topic}</span>
                          {isDue && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${C.error}18`, color: C.error }}>DUE</span>}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.front}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.back}</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: C.outline }}>
                          <span>EF: {c.ease_factor?.toFixed(1)}</span>
                          <span>Interval: {c.interval_days}d</span>
                          <span>Reps: {c.repetitions}</span>
                          <span>Due: {c.due_date?.split("T")[0]}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: C.textMuted, fontSize: 14, flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${C.error}20`; e.currentTarget.style.color = C.error; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; }}
                        title="Delete card"
                      >🗑️</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}