import { useState, useEffect } from "react";
import { getDueCards, getAllCards, createCard, deleteCard, clearAllData, reviewCard, DEMO_USER } from "../lib/api";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];

const SCORES = [
  { val: 0, label: "Again",   color: "accent-red",    desc: "Complete blackout" },
  { val: 2, label: "Hard",    color: "accent-yellow",  desc: "Wrong but familiar" },
  { val: 3, label: "Good",    color: "accent-purple",  desc: "Correct with effort" },
  { val: 4, label: "Easy",    color: "accent-blue",    desc: "Correct, some hesitation" },
  { val: 5, label: "Perfect", color: "accent-green",   desc: "Instant recall" },
];

export default function Revisions() {
  const [tab, setTab] = useState("review"); // "review" | "manage"

  // ── Review state ──────────────────────────────────────
  const [dueCards, setDueCards]   = useState([]);
  const [idx, setIdx]            = useState(0);
  const [flipped, setFlipped]    = useState(false);
  const [reviewLoading, setReviewLoading] = useState(true);

  // ── Manage state ──────────────────────────────────────
  const [allCards, setAllCards]   = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [showForm, setShowForm]  = useState(false);
  const [formSubject, setFormSubject] = useState("Physics");
  const [formTopic, setFormTopic]    = useState("");
  const [formFront, setFormFront]    = useState("");
  const [formBack, setFormBack]      = useState("");
  const [saving, setSaving]          = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // ── Data fetching ─────────────────────────────────────
  const loadDueCards = async () => {
    setReviewLoading(true);
    try {
      const res = await getDueCards(DEMO_USER);
      setDueCards(res.data?.due_cards || []);
    } catch { setDueCards([]); }
    setIdx(0); setFlipped(false);
    setReviewLoading(false);
  };

  const loadAllCards = async () => {
    setManageLoading(true);
    try {
      const res = await getAllCards(DEMO_USER);
      setAllCards(res.data?.cards || []);
    } catch { setAllCards([]); }
    setManageLoading(false);
  };

  useEffect(() => { loadDueCards(); loadAllCards(); }, []);

  // ── Review handlers ───────────────────────────────────
  const card = dueCards[idx];
  const progress = dueCards.length > 0 ? Math.round((idx / dueCards.length) * 100) : 0;

  const handleScore = async (quality) => {
    try { await reviewCard(DEMO_USER, card.id, quality); } catch {}
    setFlipped(false);
    if (idx + 1 >= dueCards.length) {
      setIdx(idx + 1); // triggers "all done" state
    } else {
      setIdx(i => i + 1);
    }
  };

  // ── Manage handlers ───────────────────────────────────
  const handleCreate = async () => {
    if (!formTopic || !formFront || !formBack) return;
    setSaving(true);
    try {
      await createCard(DEMO_USER, formSubject, formTopic, formFront, formBack);
      setFormTopic(""); setFormFront(""); setFormBack("");
      setShowForm(false);
      loadAllCards();
      loadDueCards();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async (cardId) => {
    try {
      await deleteCard(cardId);
      setAllCards(prev => prev.filter(c => c.id !== cardId));
      loadDueCards();
    } catch (e) { console.error(e); }
  };

  const handleClearAll = async () => {
    try {
      await clearAllData(DEMO_USER);
      setAllCards([]);
      setDueCards([]);
      setIdx(0);
      setConfirmClear(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="px-6 py-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-purple/20 text-lg">🧠</span>
          Spaced Repetition
        </h1>
        <p className="text-muted text-sm mt-1">SM-2 algorithm — forgetting curve based revision scheduling</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-5 mb-6 bg-surface-700 rounded-xl p-1 w-fit">
        {[
          { key: "review", label: "📖 Review Cards", count: dueCards.length },
          { key: "manage", label: "⚙️ Manage Cards", count: allCards.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === t.key
                ? "bg-accent-purple text-white shadow-lg shadow-accent-purple/20"
                : "text-muted hover:text-white"
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
              tab === t.key ? "bg-white/20" : "bg-surface-500"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ════════════════ REVIEW TAB ════════════════ */}
      {tab === "review" && (
        <div className="animate-fade-in">
          {reviewLoading ? (
            <div className="bg-surface-700 rounded-xl border border-surface-500 p-6 space-y-4">
              <div className="h-4 w-32 rounded bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
              <div className="h-40 rounded-xl bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
              <div className="h-12 rounded-lg bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
            </div>
          ) : dueCards.length === 0 ? (
            /* Empty state */
            <div className="bg-surface-700 rounded-xl border border-surface-500 flex flex-col items-center py-16 px-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-blue/20 flex items-center justify-center text-4xl mb-5">✅</div>
              <h3 className="text-lg font-bold mb-2">No Cards Due for Review</h3>
              <p className="text-sm text-muted text-center max-w-md mb-6">
                {allCards.length === 0
                  ? "You haven't created any flashcards yet. Go to the Manage tab to add some!"
                  : "All caught up! Your next reviews are scheduled by the SM-2 algorithm."
                }
              </p>
              {allCards.length === 0 && (
                <button onClick={() => setTab("manage")} className="px-5 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/80 transition-all">
                  ➕ Create Your First Card
                </button>
              )}
            </div>
          ) : idx >= dueCards.length ? (
            /* All reviewed */
            <div className="bg-surface-700 rounded-xl border border-accent-green/30 flex flex-col items-center py-16 px-6 animate-slide-up">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-accent-green mb-2">All Cards Reviewed!</h2>
              <p className="text-sm text-muted mb-6">Great session. Your spaced repetition intervals have been updated.</p>
              <button
                onClick={() => { setIdx(0); setFlipped(false); loadDueCards(); }}
                className="px-5 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/80 transition-all"
              >
                🔄 Restart Session
              </button>
            </div>
          ) : (
            /* Active review */
            <div className="space-y-4">
              {/* Progress */}
              <div className="bg-surface-700 rounded-xl border border-surface-500 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-accent-purple bg-accent-purple/15 px-2.5 py-1 rounded-md">
                    Card {idx + 1} of {dueCards.length}
                  </span>
                  <span className="text-xs text-muted font-mono">{dueCards.length - idx} remaining</span>
                </div>
                <div className="h-1.5 bg-surface-500 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Flip Card */}
              <div
                onClick={() => setFlipped(p => !p)}
                className={`rounded-2xl p-8 text-center cursor-pointer min-h-[220px] flex flex-col items-center justify-center transition-all duration-300 border ${
                  flipped
                    ? "bg-surface-700 border-accent-purple/40 shadow-lg shadow-accent-purple/10"
                    : "bg-surface-600 border-surface-500 hover:border-muted/40"
                }`}
              >
                <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
                  {flipped ? "ANSWER — tap to flip back" : "QUESTION — tap to reveal answer"}
                </div>
                {!flipped ? (
                  <>
                    <div className="text-lg font-bold leading-relaxed mb-3">{card.front}</div>
                    <div className="flex gap-2 text-[11px]">
                      <span className="px-2 py-1 rounded-md bg-accent-purple/15 text-accent-purple font-semibold">{card.subject}</span>
                      <span className="px-2 py-1 rounded-md bg-surface-500 text-muted">{card.topic}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base text-accent-purple font-semibold leading-relaxed mb-2">{card.back}</div>
                    <div className="text-xs text-muted mt-2">Rate your recall below</div>
                  </>
                )}
              </div>

              {/* Score Buttons */}
              {flipped ? (
                <div className="animate-fade-in">
                  <div className="text-xs text-muted text-center mb-3">How well did you remember this?</div>
                  <div className="grid grid-cols-5 gap-2">
                    {SCORES.map(sc => (
                      <button
                        key={sc.val}
                        onClick={() => handleScore(sc.val)}
                        className={`rounded-xl p-3 border transition-all hover:scale-[1.03] active:scale-95 text-center bg-${sc.color}/10 border-${sc.color}/30 hover:border-${sc.color}/60`}
                      >
                        <div className={`text-sm font-bold text-${sc.color}`}>{sc.label}</div>
                        <div className="text-[10px] text-muted mt-0.5">{sc.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted text-xs">👆 Tap the card to reveal the answer</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ MANAGE TAB ════════════════ */}
      {tab === "manage" && (
        <div className="animate-fade-in space-y-5">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              📚 Your Flashcards ({allCards.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 rounded-lg bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/80 transition-all active:scale-95"
              >
                ➕ Add Card
              </button>
              {allCards.length > 0 && (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-4 py-2 rounded-lg bg-accent-red/10 text-accent-red border border-accent-red/30 text-sm font-semibold hover:bg-accent-red/20 transition-all active:scale-95"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>

          {/* Confirm clear dialog */}
          {confirmClear && (
            <div className="animate-fade-in bg-surface-700 rounded-xl border border-accent-red/40 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-red/15 flex items-center justify-center text-xl shrink-0">⚠️</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-accent-red mb-1">Delete ALL data?</div>
                  <p className="text-xs text-muted mb-4">This will permanently remove all your flashcards, attempt history, study plans, and weak topic analytics. This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={handleClearAll} className="px-4 py-2 rounded-lg bg-accent-red text-white text-sm font-bold hover:bg-accent-red/80 transition-all">
                      Yes, Delete Everything
                    </button>
                    <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-lg bg-surface-500 text-muted text-sm font-semibold hover:text-white transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Card Form */}
          {showForm && (
            <div className="animate-slide-up bg-surface-700 rounded-xl border border-accent-purple/30 p-5 space-y-4">
              <h4 className="text-xs font-bold text-accent-purple uppercase tracking-widest">New Flashcard</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-muted mb-1.5">Subject</label>
                  <select
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1.5">Topic</label>
                  <input
                    value={formTopic}
                    onChange={e => setFormTopic(e.target.value)}
                    placeholder="e.g. Thermodynamics"
                    className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1.5">Front (Question)</label>
                <textarea
                  value={formFront}
                  onChange={e => setFormFront(e.target.value)}
                  rows={2}
                  placeholder="What is the first law of thermodynamics?"
                  className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60 resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1.5">Back (Answer)</label>
                <textarea
                  value={formBack}
                  onChange={e => setFormBack(e.target.value)}
                  rows={2}
                  placeholder="Energy cannot be created or destroyed, only transferred. ΔU = Q − W"
                  className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={saving || !formTopic || !formFront || !formBack}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-accent-purple/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "💾 Save Card"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface-500 text-muted text-sm font-semibold hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cards List */}
          {manageLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-xl bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
              ))}
            </div>
          ) : allCards.length === 0 ? (
            <div className="bg-surface-700 rounded-xl border border-surface-500 flex flex-col items-center py-16 px-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center text-4xl mb-5">📝</div>
              <h3 className="text-lg font-bold mb-2">No Flashcards Yet</h3>
              <p className="text-sm text-muted text-center max-w-md mb-6">
                Create your own flashcards to start spaced repetition practice. Click "Add Card" above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allCards.map((c, i) => {
                const isDue = new Date(c.due_date) <= new Date();
                return (
                  <div key={c.id} className="group bg-surface-700 rounded-xl border border-surface-500 px-5 py-4 flex items-start gap-4 hover:border-muted/40 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-surface-500 flex items-center justify-center text-xs font-bold text-muted shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple">{c.subject}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-500 text-muted">{c.topic}</span>
                        {isDue && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-red/15 text-accent-red">DUE</span>}
                      </div>
                      <div className="text-sm font-medium truncate">{c.front}</div>
                      <div className="text-xs text-muted truncate mt-0.5">{c.back}</div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-muted">
                        <span>EF: {c.ease_factor?.toFixed(1)}</span>
                        <span>Interval: {c.interval_days}d</span>
                        <span>Reps: {c.repetitions}</span>
                        <span>Due: {c.due_date}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="shrink-0 w-8 h-8 rounded-lg bg-surface-500 flex items-center justify-center text-muted hover:bg-accent-red/20 hover:text-accent-red transition-all opacity-0 group-hover:opacity-100"
                      title="Delete card"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}