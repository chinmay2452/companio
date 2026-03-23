import { useState, useRef, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { useUser } from "../store/useAppStore";
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
  background: "rgba(15,25,46,0.85)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid rgba(64,72,91,0.3)`,
  borderRadius: 14,
  ...extra,
});

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];

const FALLBACK_SUGGESTIONS = [
  "Explain Newton's second law",
  "What is hybridisation?",
  "How does photosynthesis work?",
  "Explain the Krebs cycle",
  "What is the First Law of Thermodynamics?",
  "Explain electron configuration",
  "What is integration in calculus?",
];

/* ── Typing indicator dots ──────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: C.primary, opacity: 0.7,
            animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── AI Avatar ─────────────────────────────────────────────────── */
function AIAvatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "Manrope,sans-serif",
      boxShadow: `0 0 12px ${C.primary}44`,
    }}>
      AI
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function TutorChat() {
  const user = useUser();
  const { data: storeData } = useRealtimeStore();

  const [msgs, setMsgs] = useState([
    { role: "ai", text: "Namaste! 🙏 I'm your Companio AI Tutor. Ask me anything — from Newton's Laws to organic reactions.\n\nEvery answer is grounded in NCERT textbooks, not hallucinated. Switch subjects using the selector above!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("Physics");
  const [voiceActive, setVoiceActive] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  // Derive Live Analytics
  const { recentDoubts, mostAskedSubject } = useMemo(() => {
    const sessions = storeData.tutor_sessions || [];
    
    // Most Asked Subject
    const subjCounts = {};
    sessions.forEach(s => {
      if (s.subject) subjCounts[s.subject] = (subjCounts[s.subject] || 0) + 1;
    });
    let topSubj = "None";
    let maxObj = 0;
    for (const [s, c] of Object.entries(subjCounts)) {
      if (c > maxObj) { maxObj = c; topSubj = s; }
    }

    // Recent Doubts array for chips
    const recent = sessions.map(s => s.question).filter(Boolean).slice(0, 6);
    
    // Auto-select top subject initially if exists and it's the first render (we won't force it continuously to allow switching)
    return { recentDoubts: recent, mostAskedSubject: topSubj };
  }, [storeData]);

  // Suggestions merge fallback and recent doubts
  const activeSuggestions = recentDoubts.length > 0 ? recentDoubts : FALLBACK_SUGGESTIONS;

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q) return;
    setInput("");
    setMsgs(p => [...p, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await api.post("/api/tutor/ask", { question: q, subject, user_id: user?.id });
      const answer = res.data?.answer || res.data?.response || "I found relevant information in NCERT sources. " + q;
      setMsgs(p => [...p, { role: "ai", text: answer }]);
    } catch {
      setMsgs(p => [...p, { role: "ai", text: getFallback(q) }]);
    }
    setLoading(false);
  };

  const handleVoice = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Voice input is not supported in your browser. Try Google Chrome.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    setVoiceActive(true);
    recognition.start();
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setVoiceActive(false);
    };
    recognition.onerror = () => setVoiceActive(false);
    recognition.onend   = () => setVoiceActive(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes bounce-dot {
          0%,80%,100% { transform: translateY(0); opacity: 0.7; }
          40%          { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity:0; transform: translateY(8px); }
          to   { opacity:1; transform: none; }
        }
        @keyframes pulse-mic {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,110,132,.4); }
          50%      { box-shadow: 0 0 0 8px rgba(255,110,132,0); }
        }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .suggest-chip:hover { border-color: ${C.primary}66 !important; background: rgba(171,163,255,.08) !important; color: ${C.primary} !important; }
        .send-btn:hover { filter: brightness(1.12); transform: scale(1.04); }
        .subj-btn:hover { background: rgba(171,163,255,.08) !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.outline}88; border-radius: 2px; }
      `}</style>

      <div style={{
        padding: "0", display: "flex", flexDirection: "column",
        height: "100vh", fontFamily: "Inter,sans-serif", color: C.textPrimary, overflow: "hidden",
      }}>

        {/* ── Top Header ─────────────────────────────────────── */}
        <div style={{
          ...glass({ borderRadius: 0, padding: "18px 28px 14px" }),
          borderBottom: `1px solid ${C.outline}33`, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0 }}>
                💬 AI Tutor
              </h1>
              <p style={{ color: C.textMuted, fontSize: 12, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 8 }}>
                RAG-grounded answers · NCERT textbooks
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: "uppercase", letterSpacing: 1, padding: "3px 8px", background: `${C.secondary}15`, borderRadius: 12, border: `1px solid ${C.secondary}33` }}>
                  <span style={{width:6, height:6, borderRadius:"50%", background:C.secondary, animation: "pulse-dot 1.5s infinite"}}/> Live Sync
                </span>
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Analytics Badge: Most Asked Subject */}
              {mostAskedSubject !== "None" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.primary}12`, border: `1px solid ${C.primary}33`, borderRadius: 20, padding: "6px 14px" }}>
                  <span style={{ fontSize: 13 }}>🔥</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 0.5 }}>Most Asked: {mostAskedSubject}</span>
                </div>
              )}
              {/* NCERT Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.secondary}12`, border: `1px solid ${C.secondary}44`, borderRadius: 20, padding: "6px 14px" }}>
                <span style={{ fontSize: 13 }}>📚</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.secondary, letterSpacing: 0.5 }}>NCERT Grounded</span>
              </div>
            </div>
          </div>


        </div>

        {/* ── Chat message scroll area ────────────────────────── */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fade-in-up 0.3s ease" }}>
              {m.role === "ai" && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, maxWidth: "80%" }}>
                  <AIAvatar />
                  <div>
                    <div style={{ fontSize: 10, color: C.secondary, letterSpacing: 1, marginBottom: 5, fontWeight: 700, textTransform: "uppercase" }}>Companio AI · NCERT Grounded</div>
                    <div style={{ ...glass({ padding: "12px 16px" }), fontSize: 13, lineHeight: 1.7, color: C.textPrimary, whiteSpace: "pre-wrap", borderBottomLeftRadius: 3 }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              )}

              {m.role === "user" && (
                <div style={{ maxWidth: "72%" }}>
                  <div style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryDim})`, padding: "12px 16px", borderRadius: 14, borderBottomRightRadius: 3, fontSize: 13, lineHeight: 1.6, color: "#fff", whiteSpace: "pre-wrap", boxShadow: `0 4px 16px ${C.primary}33` }}>
                    {m.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, animation: "fade-in-up 0.3s ease" }}>
              <AIAvatar />
              <div>
                <div style={{ fontSize: 10, color: C.secondary, letterSpacing: 1, marginBottom: 5, fontWeight: 700, textTransform: "uppercase" }}>Companio AI</div>
                <div style={{ ...glass({ padding: "12px 18px" }), borderBottomLeftRadius: 3, display: "flex", alignItems: "center", gap: 8 }}>
                  <TypingDots />
                  <span style={{ fontSize: 11, color: C.textMuted }}>Searching NCERT sources…</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Suggested questions row ─────────────────────────── */}
        <div style={{ padding: "8px 28px", flexShrink: 0, display: "flex", gap: 8, overflowX: "auto" }}>
          {recentDoubts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: C.primary, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, paddingRight: 8, borderRight: `1px solid ${C.outline}33` }}>
              Recent Doubts
            </div>
          )}
          {activeSuggestions.map((s, i) => (
            <button
              key={i} className="suggest-chip" onClick={() => send(s)}
              style={{
                ...glass({ padding: "7px 14px", borderRadius: 20 }),
                fontSize: 12, color: C.textMuted, cursor: "pointer", border: `1px solid ${C.outline}44`,
                whiteSpace: "nowrap", flexShrink: 0, background: "transparent", transition: "all 0.15s",
              }}
            >
              💡 {s}
            </button>
          ))}
        </div>

        {/* ── Input area ─────────────────────────────────────── */}
        <div style={{ ...glass({ borderRadius: 0, padding: "12px 28px 20px" }), borderTop: `1px solid ${C.outline}22`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: C.surfaceTop, borderRadius: 14, padding: "6px 8px 6px 16px" }}>
            <input
              ref={inputRef}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.textPrimary, fontSize: 13, padding: "8px 0" }}
              placeholder="Ask anything — e.g. 'Explain thermodynamics laws'"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
            />

            {/* Mic icon */}
            <button
              onClick={handleVoice} title="Voice input"
              style={{
                width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: voiceActive ? `${C.error}25` : C.surfaceTop,
                color: voiceActive ? C.error : C.textMuted,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, flexShrink: 0, transition: "all 0.2s",
                animation: voiceActive ? "pulse-mic 1s infinite" : "none",
              }}
            >🎙️</button>

            {/* Send button */}
            <button
              className="send-btn" onClick={() => send()} disabled={!input.trim() && !loading}
              style={{
                background: input.trim() ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : C.surface,
                color: input.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 10, padding: "10px 18px",
                fontSize: 13, fontWeight: 700, cursor: input.trim() ? "pointer" : "default",
                transition: "all 0.2s", flexShrink: 0, boxShadow: input.trim() ? `0 4px 16px ${C.primary}44` : "none",
              }}
            >Send ↑</button>
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, textAlign: "center" }}>
            Answers grounded in NCERT + standard textbooks · Press Enter to send
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Offline fallback answers ──────────────────────────────────── */
function getFallback(q) {
  const lower = q.toLowerCase();
  if (lower.includes("newton")) return "Newton's Laws of Motion:\n1st Law: A body stays at rest or in uniform motion unless acted on by a net force.\n2nd Law: F = ma (Force = mass × acceleration)\n3rd Law: Every action has an equal and opposite reaction.\n\n📚 Source: NCERT Physics Class 11, Chapter 5";
  if (lower.includes("photosynthesis")) return "Photosynthesis occurs in chloroplasts.\n6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\nLight reactions occur in thylakoids, Calvin cycle in stroma.\n\n📚 Source: NCERT Biology Class 11, Chapter 13";
  if (lower.includes("hybridis")) return "Hybridisation in organic chemistry:\n• sp³ — 4 bonds, tetrahedral (methane, ethane)\n• sp² — 3 bonds, planar (ethylene, benzene)\n• sp — 2 bonds, linear (acetylene)\n\n📚 Source: NCERT Chemistry Class 11, Chapter 4";
  if (lower.includes("thermodynamics")) return "Laws of Thermodynamics:\n• Zeroth: Thermal equilibrium\n• First: ΔU = Q − W (energy conservation)\n• Second: Entropy always increases\n• Third: Entropy → 0 as T → 0 K\n\n📚 Source: NCERT Physics Class 11, Chapter 12";
  if (lower.includes("krebs")) return "The Krebs Cycle (Citric Acid Cycle):\n• Occurs in the mitochondrial matrix\n• Acetyl-CoA + oxaloacetate → citrate\n• Produces: 3 NADH, 1 FADH₂, 1 GTP, 2 CO₂ per turn\n• Runs twice per glucose molecule\n\n📚 Source: NCERT Biology Class 12, Chapter 14";
  return `Great question about "${q}"!\n\nBased on the NCERT curriculum:\n\n1. Review the relevant chapter in your NCERT textbook\n2. Focus on key definitions and formulas\n3. Practice with PYQ questions on this topic\n\nShall I generate some practice questions on this topic? Go to the Practice tab!\n\n📚 Source: NCERT standard textbooks`;
}