import { useState, useEffect } from "react";
import { generateQuestions, submitAnswer, getWeakAreas, DEMO_USER } from "../lib/api";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function Practice() {
  const [subject,    setSubject]    = useState("Physics");
  const [topic,      setTopic]      = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questions,  setQuestions]  = useState(null);
  const [qIdx,       setQIdx]       = useState(0);
  const [selected,   setSelected]   = useState(null);
  const [revealed,   setRevealed]   = useState(false);
  const [stats,      setStats]      = useState({ correct: 0, wrong: 0 });
  const [startTime,  setStartTime]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [weakFlag,   setWeakFlag]   = useState(false);
  const [weakTopics, setWeakTopics] = useState([]);
  const [totalTime,  setTotalTime]  = useState(0);

  // Fetch weak areas on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getWeakAreas(DEMO_USER);
        if (res.data?.weak_areas) setWeakTopics(res.data.weak_areas.slice(0, 5));
      } catch { /* analytics not ready yet */ }
    })();
  }, []);

  const loadQuestions = async () => {
    if (!subject || !topic) return;
    console.log("Generating questions:", { subject, topic, difficulty });
    setLoading(true);
    setQIdx(0); setSelected(null); setRevealed(false);
    setStats({ correct: 0, wrong: 0 }); setWeakFlag(false); setTotalTime(0);
    try {
      const res = await generateQuestions(subject, topic, difficulty);
      if (res.data?.questions?.length) {
        setQuestions(res.data.questions);
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    }
    setStartTime(Date.now());
    setLoading(false);
  };

  const qs = questions || [];
  const q  = qs[qIdx];
  const accuracy = (stats.correct + stats.wrong) > 0
    ? Math.round(stats.correct / (stats.correct + stats.wrong) * 100) : 0;
  const avgTime = (stats.correct + stats.wrong) > 0
    ? Math.round(totalTime / (stats.correct + stats.wrong)) : 0;

  const [generatedCard, setGeneratedCard] = useState(null);

  const handleSelect = async (opt) => {
    if (revealed) return;
    setSelected(opt);
    setRevealed(true);
    setGeneratedCard(null);
    const correct = opt === q.answer;
    const timeSec = Math.round((Date.now() - startTime) / 1000);
    setTotalTime(t => t + timeSec);
    const newStats = { correct: stats.correct + (correct ? 1 : 0), wrong: stats.wrong + (correct ? 0 : 1) };
    setStats(newStats);
    if (!correct && newStats.wrong >= 2) setWeakFlag(true);
    try {
      const res = await submitAnswer(DEMO_USER, q.id, q.question, opt, q.answer, timeSec, subject, topic);
      if (res.data?.flashcard_generated) {
        setGeneratedCard(res.data.flashcard_generated);
      }
    } catch (e) { console.error(e); }
  };

  const nextQ = () => {
    setQIdx(i => i + 1);
    setSelected(null);
    setRevealed(false);
    setGeneratedCard(null);
    setStartTime(Date.now());
  };

  const topWeakTopic = weakTopics[0];
  const progressPct = qs.length > 0 ? Math.round(((qIdx + (revealed ? 1 : 0)) / qs.length) * 100) : 0;

  return (
    <div className="px-6 py-7 max-w-7xl mx-auto">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-purple/20 text-lg">🎯</span>
          Adaptive Practice
        </h1>
        <p className="text-muted text-sm mt-1">
          AI detects your weak areas from accuracy + response time and generates targeted questions
        </p>
      </div>

      {/* ── AI Recommendation Banner ─────────────────────── */}
      {topWeakTopic && !questions && (
        <div className="animate-fade-in mt-4 mb-6 relative overflow-hidden rounded-xl border border-accent-purple/30 bg-gradient-to-r from-accent-purple/10 via-surface-700 to-accent-blue/10 p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/5 to-accent-blue/5 animate-pulse-slow" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-xl">🧠</div>
              <div>
                <div className="text-xs font-bold text-accent-purple uppercase tracking-wider mb-0.5">AI Recommendation</div>
                <div className="text-sm">
                  Practice <span className="font-bold text-white">{topWeakTopic.topic}</span>
                  <span className="text-muted"> — </span>
                  <span className="text-accent-red font-semibold">{Math.round((topWeakTopic.accuracy || 0.4) * 100)}% accuracy</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setSubject(topWeakTopic.subject || subject);
                setTopic(topWeakTopic.topic || "");
                setTimeout(loadQuestions, 50);
              }}
              className="px-4 py-2 rounded-lg bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/80 transition-all hover:shadow-lg hover:shadow-accent-purple/25 active:scale-95"
            >
              ⚡ Start AI Practice
            </button>
          </div>
        </div>
      )}

      {/* ── Stats Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Weakest Topic",
            value: topWeakTopic?.topic || "—",
            sub: topWeakTopic?.subject || "No data yet",
            color: "text-accent-red",
            icon: "🔥",
            border: "border-accent-red/20",
          },
          {
            label: "Avg Response",
            value: avgTime > 0 ? `${avgTime}s` : "—",
            sub: avgTime > 0 ? (avgTime < 15 ? "Fast" : avgTime < 30 ? "Normal" : "Slow") : "No attempts",
            color: "text-accent-blue",
            icon: "⏱️",
            border: "border-accent-blue/20",
          },
          {
            label: "Accuracy",
            value: (stats.correct + stats.wrong) > 0 ? `${accuracy}%` : "—",
            sub: (stats.correct + stats.wrong) > 0 ? `${stats.correct}/${stats.correct + stats.wrong} correct` : "No attempts",
            color: accuracy > 70 ? "text-accent-green" : "text-accent-yellow",
            icon: "📊",
            border: accuracy > 70 ? "border-accent-green/20" : "border-accent-yellow/20",
          },
          {
            label: "Recommended",
            value: topWeakTopic?.subject || subject,
            sub: "Focus subject",
            color: "text-accent-purple",
            icon: "🎯",
            border: "border-accent-purple/20",
          },
        ].map((s, i) => (
          <div key={i} className={`bg-surface-700 rounded-xl border ${s.border} p-4 hover:border-opacity-60 transition-all group`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{s.icon}</span>
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{s.label}</span>
            </div>
            <div className={`text-xl font-extrabold ${s.color} leading-tight truncate`}>{s.value}</div>
            <div className="text-[11px] text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main 2-Column Layout ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Controls (1/3 width) */}
        <div className="lg:col-span-1 space-y-4">
          {/* Config Panel */}
          <div className="bg-surface-700 rounded-xl border border-surface-500 p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
              <span>⚙️</span> Configuration
            </h3>

            <div>
              <label className="block text-[11px] text-muted mb-1.5">Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors appearance-none cursor-pointer"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-muted mb-1.5">Topic</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. F block, Rotational Mechanics"
                className="w-full bg-surface-600 border border-surface-500 rounded-lg text-[13px] text-white px-3 py-2.5 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60"
              />
            </div>

            <div>
              <label className="block text-[11px] text-muted mb-1.5">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      difficulty === d
                        ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/40"
                        : "bg-surface-800 text-muted border border-surface-500 hover:border-muted/40"
                    }`}
                  >
                    {d === "Easy" ? "🟢" : d === "Medium" ? "🟡" : "🔴"} {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={loadQuestions}
              disabled={loading || !subject || !topic}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-accent-purple/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </span>
              ) : (
                "⚡ Generate Questions"
              )}
            </button>
          </div>

          {/* Weak Topics Panel */}
          <div className="bg-surface-700 rounded-xl border border-surface-500 p-5">
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 mb-3">
              <span>📉</span> Weak Topics
            </h3>
            {weakTopics.length > 0 ? (
              <div className="space-y-2.5">
                {weakTopics.map((wt, i) => {
                  const pct = Math.round((wt.accuracy || 0.4) * 100);
                  const barColor = pct < 40 ? "bg-accent-red" : pct < 70 ? "bg-accent-yellow" : "bg-accent-green";
                  return (
                    <div key={i} className="group">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium truncate">{wt.topic}</span>
                        <span className={`text-[10px] font-bold ${pct < 40 ? "text-accent-red" : pct < 70 ? "text-accent-yellow" : "text-accent-green"}`}>{pct}%</span>
                      </div>
                      <div className="h-1 bg-surface-500 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted py-4 text-center">
                Practice some topics to see analytics.
              </p>
            )}
          </div>

          {/* Last Attempt Summary */}
          {(stats.correct + stats.wrong) > 0 && (
            <div className="bg-surface-700 rounded-xl border border-surface-500 p-5 animate-fade-in">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 mb-3">
                <span>📋</span> Session Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Correct</span>
                  <span className="text-accent-green font-bold">{stats.correct}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Wrong</span>
                  <span className="text-accent-red font-bold">{stats.wrong}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Accuracy</span>
                  <span className={`font-bold ${accuracy > 70 ? "text-accent-green" : "text-accent-yellow"}`}>{accuracy}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Avg Time</span>
                  <span className="text-accent-blue font-bold">{avgTime}s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Question Area (2/3 width) */}
        <div className="lg:col-span-2">

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-surface-700 rounded-xl border border-surface-500 p-6 space-y-5 animate-fade-in">
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-5 w-28 rounded bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
                <div className="h-4 w-3/4 rounded bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
              </div>
              <div className="space-y-3 mt-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-gradient-to-r from-surface-500 via-surface-400 to-surface-500 bg-[length:200%_100%] animate-shimmer" />
                ))}
              </div>
              <p className="text-xs text-muted text-center pt-2">AI is generating {subject} questions on {topic}…</p>
            </div>
          )}

          {/* Question Card */}
          {q && !loading && (
            <div className="animate-slide-up space-y-4">
              {/* Progress Header */}
              <div className="bg-surface-700 rounded-xl border border-surface-500 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-accent-purple bg-accent-purple/15 px-2.5 py-1 rounded-md">
                      Question {qIdx + 1} of {qs.length}
                    </span>
                    <span className="text-[10px] text-muted bg-surface-500 px-2 py-1 rounded-md">
                      {subject} · {topic}
                    </span>
                    {q.concept_tested && (
                      <span className="text-[10px] text-accent-blue bg-accent-blue/15 px-2 py-1 rounded-md font-semibold border border-accent-blue/30">
                        Concept: {q.concept_tested}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted font-mono">{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-surface-500 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Question Body */}
              <div className="bg-surface-700 rounded-xl border border-surface-500 p-6">
                <div className="text-base font-semibold leading-relaxed mb-5">{q.question}</div>

                <div className="space-y-2.5">
                  {q.options.map((opt, i) => {
                    let classes = "bg-surface-600 border-surface-500 text-white hover:border-accent-purple/40 cursor-pointer";
                    if (revealed) {
                      if (opt === q.answer) {
                        classes = "bg-accent-green/10 border-accent-green/50 text-accent-green";
                      } else if (opt === selected) {
                        classes = "bg-accent-red/10 border-accent-red/50 text-accent-red";
                      } else {
                        classes = "bg-surface-600 border-surface-500 text-muted opacity-50";
                      }
                    }
                    return (
                      <div
                        key={i}
                        onClick={() => handleSelect(opt)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 ${classes} ${revealed ? "cursor-default" : ""}`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          revealed && opt === q.answer ? "bg-accent-green/20 text-accent-green" :
                          revealed && opt === selected ? "bg-accent-red/20 text-accent-red" :
                          "bg-surface-500 text-muted"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation + Navigation */}
                {revealed && (
                  <div className="mt-5 animate-fade-in">
                    <div className={`rounded-xl p-4 border ${
                      selected === q.answer
                        ? "bg-accent-green/5 border-accent-green/30"
                        : "bg-accent-red/5 border-accent-red/30"
                    }`}>
                      <div className={`text-sm font-bold mb-2 ${
                        selected === q.answer ? "text-accent-green" : "text-accent-red"
                      }`}>
                        {selected === q.answer ? "✅ Correct!" : `❌ Incorrect — Correct Answer: ${q.answer}`}
                      </div>
                      <div className="text-xs text-muted leading-relaxed pb-1 border-t border-surface-500 pt-2 mt-2">
                        <strong className="text-white">Explanation:</strong> {q.explanation}
                      </div>
                    </div>

                    {/* Auto-generated flashcard notification */}
                    {revealed && selected !== q.answer && generatedCard && (
                      <div className="mt-3 animate-slide-up bg-gradient-to-r from-accent-purple/10 via-surface-700 to-accent-blue/10 rounded-xl border border-accent-purple/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center text-base shrink-0">📝</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-accent-purple mb-1">Flashcard Auto-Generated</div>
                            <div className="text-sm font-semibold text-white truncate">
                              {generatedCard.concept}
                              {generatedCard.formula && (
                                <span className="ml-2 text-accent-blue font-mono text-xs">{generatedCard.formula}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted mt-1 truncate">{generatedCard.front}</div>
                            <div className="text-[10px] text-accent-green/70 mt-1">✓ Added to your Revision queue — due today</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {revealed && selected !== q.answer && !generatedCard && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-accent-yellow">
                        <span>⚠️</span> Processing — generating revision card…
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4">
                      <div />
                      {qIdx < qs.length - 1 ? (
                        <button
                          onClick={nextQ}
                          className="px-5 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/80 transition-all active:scale-95"
                        >
                          Next Question →
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={loadQuestions}
                            className="px-4 py-2.5 rounded-xl bg-accent-green/10 text-accent-green border border-accent-green/30 text-sm font-semibold hover:bg-accent-green/20 transition-all active:scale-95"
                          >
                            🔄 New Set
                          </button>
                          <button
                            onClick={() => setQuestions(null)}
                            className="px-4 py-2.5 rounded-xl bg-accent-red/10 text-accent-red border border-accent-red/30 text-sm font-semibold hover:bg-accent-red/20 transition-all active:scale-95"
                          >
                            ✏️ Change Topic
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!q && !loading && (
            <div className="animate-fade-in bg-surface-700 rounded-xl border border-surface-500 flex flex-col items-center justify-center py-16 px-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center text-4xl mb-5">
                🧠
              </div>
              <h3 className="text-lg font-bold mb-2">Generate Adaptive Questions</h3>
              <p className="text-sm text-muted text-center max-w-md mb-6">
                Select a subject and topic from the configuration panel, then click
                <span className="text-accent-purple font-semibold"> ⚡ Generate Questions</span> to begin AI-powered practice.
              </p>
              <div className="flex items-center gap-6 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green" /> Real-time analytics
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" /> Adaptive difficulty
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" /> Weak-area detection
                </span>
              </div>
            </div>
          )}

          {/* Empty result from AI */}
          {questions && qs.length === 0 && !loading && (
            <div className="animate-fade-in bg-surface-700 rounded-xl border border-accent-yellow/30 flex flex-col items-center justify-center py-12 px-6">
              <div className="text-3xl mb-3">⚠️</div>
              <h3 className="text-base font-bold mb-1.5">No Questions Generated</h3>
              <p className="text-sm text-muted text-center max-w-sm mb-4">
                The AI couldn't generate questions for this topic. Try a different topic or check your backend server.
              </p>
              <button
                onClick={() => setQuestions(null)}
                className="px-4 py-2 rounded-lg bg-accent-purple/20 text-accent-purple text-sm font-semibold hover:bg-accent-purple/30 transition-all"
              >
                ← Back to Config
              </button>
            </div>
          )}

          {/* Weakness Alert */}
          {weakFlag && (
            <div className="animate-slide-up mt-4 bg-surface-700 rounded-xl border border-accent-red/30 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-red/15 flex items-center justify-center text-xl shrink-0">⚠️</div>
                <div>
                  <div className="text-sm font-bold text-accent-red mb-1">Weakness Detected by AI</div>
                  <p className="text-xs text-muted leading-relaxed">
                    Pattern of errors in <span className="text-white font-semibold">{subject} — {topic}</span>.
                    The study planner will automatically increase revision frequency. Targeted questions queued.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}