import React, { useState, useRef, useEffect } from "react";
import { askTutorHindi } from "../../lib/api";
import { useUser } from "../../store/useAppStore";

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

/* ── State configuration ────────────────────────────────────────── */
const STATE_CFG = {
  idle:      { color: C.textMuted,  glow: C.outline,    label: "Press to speak",     hint: "Click the mic and speak your doubt", icon: "🎙️" },
  listening: { color: C.error,      glow: C.error,       label: "Listening…",          hint: "Speaking… click again to stop",      icon: "🔴" },
  thinking:  { color: C.tertiary,   glow: C.tertiary,    label: "Processing…",         hint: "Groq AI is preparing your answer",   icon: "⏳" },
  speaking:  { color: C.secondary,  glow: C.secondary,   label: "Speaking…",           hint: "Answering aloud — click to stop",    icon: "🔊" },
};

const HISTORY_MAX = 5;

/* ── SVG Waveform ────────────────────────────────────────────────── */
function Waveform({ active, color }) {
  const bars = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div style={{ height: 36, display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
      {bars.map(i => (
        <div
          key={i}
          style={{
            width: 3, borderRadius: 2,
            height: active ? `${12 + Math.random() * 24}px` : 4,
            background: active
              ? `linear-gradient(to top,${C.primaryDim},${color})`
              : C.outline,
            animation: active ? `wave-bar ${0.4 + (i % 5) * 0.08}s ease-in-out ${(i * 0.04).toFixed(2)}s infinite alternate` : "none",
            transition: "height 0.1s",
          }}
        />
      ))}
    </div>
  );
}

/* ── Mic pulse rings ─────────────────────────────────────────────── */
function PulseRings({ state }) {
  if (state === "idle" || state === "thinking") return null;
  const color = state === "listening" ? C.error : C.secondary;
  return (
    <>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            position: "absolute", borderRadius: "50%",
            border: `2px solid ${color}`,
            width: 140 + i * 44, height: 140 + i * 44,
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            opacity: 0,
            animation: `ring-pulse 2s ease-out ${(i - 1) * 0.5}s infinite`,
          }}
        />
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function VoiceHindiTutor() {
  const user    = useUser();
  const [voiceState, setVoiceState] = useState("idle");
  const [history,    setHistory]    = useState([]);
  const [lastQ,      setLastQ]      = useState("");
  const [lastA,      setLastA]      = useState("");
  const [interim,    setInterim]    = useState(""); // live transcription
  const [textInput,  setTextInput]  = useState("");
  const [lang,       setLang]       = useState("hi-IN");
  const [error,      setError]      = useState("");
  const recognitionRef = useRef(null);

  const cfg = STATE_CFG[voiceState];

  /* ── Speech recognition ───────────────────────────────────────── */
  const startListening = () => {
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input requires Chrome browser."); return; }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart  = () => { setVoiceState("listening"); setInterim(""); };
    recognition.onerror  = () => { setVoiceState("idle"); setError("Mic error — please allow microphone access."); };

    recognition.onresult = (e) => {
      let interimTxt = "", finalTxt = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
        else interimTxt += e.results[i][0].transcript;
      }
      setInterim(interimTxt);
      if (finalTxt.trim()) { setInterim(""); processQuestion(finalTxt.trim()); }
    };

    recognition.start();
  };

  const processQuestion = async (question) => {
    setLastQ(question);
    setVoiceState("thinking");
    const recentHistory = history.slice(-HISTORY_MAX);
    let answer = "";
    try {
      const res = await askTutorHindi(question, recentHistory, "General", user?.id, lang);
      answer = res.data?.answer || res.data?.response || "";
    } catch {
      answer = getHindiAnswer(question);
    }
    setLastA(answer);
    setHistory(h => [...h, { role: "user", text: question }, { role: "ai", text: answer }]);
    speakAnswer(answer);
  };

  const speakAnswer = (text) => {
    setVoiceState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onend = () => setVoiceState("idle");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleMicClick = () => {
    if (voiceState === "idle")      startListening();
    else if (voiceState === "listening") { recognitionRef.current?.stop(); setVoiceState("idle"); }
    else if (voiceState === "speaking")  { window.speechSynthesis.cancel(); setVoiceState("idle"); }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    const q = textInput.trim();
    if (!q || voiceState === "thinking" || voiceState === "listening") return;
    setTextInput("");
    processQuestion(q);
  };

  const replay = () => { if (lastA) speakAnswer(lastA); };

  const recentQuestions = history.filter(m => m.role === "user").slice(-4);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes ring-pulse { 0%{opacity:.6;transform:translate(-50%,-50%) scale(0.85)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)} }
        @keyframes wave-bar   { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
        @keyframes spin        { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fade-in     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes breathe     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        .lang-btn:hover  { filter: brightness(1.1); }
        .cta-btn:hover   { filter: brightness(1.12); transform: scale(1.02); }
        .hist-row:hover  { background: ${C.surfaceHi} !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.outline}88; border-radius: 2px; }
      `}</style>

      <div style={{ padding: "24px 28px", fontFamily: "Inter,sans-serif", color: C.textPrimary, maxWidth: 720, margin: "0 auto" }}>

        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Manrope,sans-serif", margin: 0 }}>
              🎙️ Hindi Voice Tutor
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "5px 0 0" }}>
              Speak your doubt in Hindi or Hinglish — AI answers aloud
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.secondary}15`, border: `1px solid ${C.secondary}44`, borderRadius: 20, padding: "6px 14px", flexShrink: 0 }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.secondary }}>NCERT + Groq AI</span>
          </div>
        </div>

        {/* ── Language toggle pills ─────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36, justifyContent: "center" }}>
          {[
            { code: "hi-IN", label: "🇮🇳 Hindi",   hint: "Pure Hindi responses" },
            { code: "en-IN", label: "🗣 Hinglish", hint: "Hindi-English mix" },
          ].map(({ code, label, hint }) => (
            <button
              key={code}
              className="lang-btn"
              onClick={() => setLang(code)}
              title={hint}
              style={{
                padding: "10px 24px", borderRadius: 24, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s",
                background: lang === code ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : C.surfaceTop,
                color:      lang === code ? "#fff" : C.textMuted,
                boxShadow:  lang === code ? `0 4px 16px ${C.primary}44` : "none",
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── Centered mic button ───────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {/* Mic circle with ripple rings */}
          <div style={{ position: "relative", width: 140, height: 140, marginBottom: 20 }}>
            <PulseRings state={voiceState} />
            <div
              onClick={handleMicClick}
              style={{
                width: 140, height: 140, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 48, position: "relative", zIndex: 1, transition: "all 0.3s",
                background: voiceState === "idle"
                  ? C.surfaceTop
                  : voiceState === "listening" ? `${C.error}22`
                  : voiceState === "thinking"  ? `${C.tertiary}18`
                  : `${C.secondary}18`,
                border: `3px solid ${cfg.glow}${voiceState === "idle" ? "55" : ""}`,
                boxShadow: voiceState !== "idle"
                  ? `0 0 32px ${cfg.glow}44, 0 0 60px ${cfg.glow}22`
                  : `0 0 16px ${C.outline}44`,
                animation: voiceState === "idle" ? "breathe 4s ease-in-out infinite"
                  : voiceState === "thinking" ? "breathe 1s ease-in-out infinite"
                  : "none",
              }}
            >
              {voiceState === "thinking"
                ? <div style={{ fontSize: 40, animation: "spin 1.2s linear infinite" }}>⏳</div>
                : <span>{cfg.icon}</span>
              }
            </div>
          </div>

          {/* State label */}
          <div style={{ fontSize: 16, fontWeight: 700, color: cfg.color, fontFamily: "Manrope,sans-serif", marginBottom: 6 }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" }}>{cfg.hint}</div>

          {/* Waveform (only when listening) */}
          <div style={{ marginTop: 20, width: "100%", maxWidth: 320 }}>
            <Waveform active={voiceState === "listening" || voiceState === "speaking"} color={cfg.glow} />
          </div>

          {/* State indicator bar */}
          <div style={{
            marginTop: 16, display: "flex", alignItems: "center", gap: 8,
            ...glass({ padding: "8px 20px", borderRadius: 24 }),
            border: `1px solid ${cfg.glow}33`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: cfg.color,
              boxShadow: voiceState !== "idle" ? `0 0 8px ${cfg.color}` : "none",
              animation: voiceState === "listening" ? "breathe 0.8s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: 1 }}>
              {voiceState}
            </span>
            {voiceState === "speaking" && (
              <button onClick={() => { window.speechSynthesis.cancel(); setVoiceState("idle"); }} style={{ background: `${C.error}20`, color: C.error, border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: 4 }}>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* ── Live transcription preview ────────────────────────── */}
        {(interim || (lastQ && voiceState !== "idle" && voiceState !== "speaking")) && (
          <div style={{ ...glass({ padding: "14px 18px", marginBottom: 16 }), border: `1px solid ${C.primary}33`, animation: "fade-in 0.3s ease" }}>
            <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 6 }}>
              🎤 Live Transcription
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, fontStyle: "italic" }}>
              {interim || lastQ}
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div style={{ ...glass({ padding: "12px 16px", marginBottom: 16 }), border: `1px solid ${C.error}44`, background: `${C.error}10`, animation: "fade-in 0.2s ease" }}>
            <span style={{ fontSize: 12, color: C.error }}>⚠️ {error}</span>
          </div>
        )}

        {/* ── Current Q&A card ──────────────────────────────────── */}
        {(lastQ || lastA) && (
          <div style={{ ...glass({ padding: "18px 20px", marginBottom: 16 }), animation: "fade-in 0.4s ease" }}>
            {lastQ && (
              <div style={{ marginBottom: lastA ? 14 : 0 }}>
                <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>You Asked</div>
                <div style={{ fontSize: 14, color: C.textPrimary, fontStyle: "italic" }}>"{lastQ}"</div>
              </div>
            )}
            {lastA && (
              <div>
                <div style={{ fontSize: 10, color: C.primary, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6, fontWeight: 700 }}>AI Answer</div>
                <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 10 }}>{lastA}</div>
                <button
                  onClick={replay}
                  style={{
                    background: `${C.primary}18`, color: C.primary,
                    border: `1px solid ${C.primary}33`, borderRadius: 8,
                    padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  🔁 Replay Answer
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Recent Questions List ────────────────────────────── */}
        {recentQuestions.length > 0 && (
          <div style={{ ...glass({ padding: "18px 20px", marginBottom: 16 }), animation: "fade-in 0.3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>
                📋 Recent Questions
              </div>
              <button onClick={() => { setHistory([]); setLastQ(""); setLastA(""); }} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
                Clear
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentQuestions.map((q, i) => (
                <div
                  key={i}
                  className="hist-row"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 9, transition: "background 0.15s",
                    borderLeft: `3px solid ${C.primary}55`,
                  }}
                >
                  <span style={{ fontSize: 12, color: C.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.text}
                  </span>
                  <button
                    onClick={() => processQuestion(q.text)}
                    style={{
                      background: `${C.primary}18`, color: C.primary,
                      border: "none", borderRadius: 6, padding: "3px 10px",
                      fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: 10, flexShrink: 0,
                    }}
                  >
                    Ask again
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Text fallback input ───────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Or type your question
          </div>
          <form onSubmit={handleTextSubmit} style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: C.surfaceTop, borderRadius: 10, display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Type your doubt if mic isn't working…"
                disabled={voiceState === "thinking"}
                style={{ flex: 1, background: "transparent", border: "none", color: C.textPrimary, fontSize: 13, padding: "12px 0", outline: "none" }}
              />
            </div>
            <button
              className="cta-btn"
              type="submit"
              disabled={!textInput.trim() || voiceState === "thinking"}
              style={{
                background: textInput.trim() ? `linear-gradient(135deg,${C.primary},${C.primaryDim})` : C.surfaceTop,
                color: textInput.trim() ? "#fff" : C.textMuted,
                border: "none", borderRadius: 10, padding: "0 20px",
                fontSize: 13, fontWeight: 700, cursor: textInput.trim() ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Send
            </button>
          </form>
        </div>

        {/* ── How it works ─────────────────────────────────────── */}
        <div style={{ ...glass({ padding: "18px 20px" }) }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700, marginBottom: 14 }}>How It Works</div>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { icon: "🎙️", title: "Voice Input (STT)",  desc: "Web Speech API captures Hindi/Hinglish speech", color: C.error },
              { icon: "🤖", title: "Groq AI Processing", desc: "LLaMA-3 generates a NCERT-grounded answer",     color: C.tertiary },
              { icon: "🔊", title: "Voice Output (TTS)", desc: "SpeechSynthesis reads the answer aloud",         color: C.secondary },
            ].map((step, i) => (
              <div key={i} style={{ flex: 1, padding: "0 12px", borderLeft: i > 0 ? `1px solid ${C.outline}44` : "none" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{step.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: step.color, marginBottom: 4 }}>{step.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Offline Hindi fallback ────────────────────────────────────── */
function getHindiAnswer(q) {
  const lower = q.toLowerCase();
  if (lower.includes("newton") || lower.includes("nyuton"))
    return "Newton ke teen niyam hain:\n1. Pahla niyam: Koi bhi vastu apni avastha mein rehti hai jab tak baahari bal na lage.\n2. Doosra niyam: F = ma\n3. Teesra niyam: Har kriya ki viprit aur barabar pratikriya hoti hai.\n\n📚 NCERT Physics Class 11, Chapter 5";
  if (lower.includes("thermodynamics") || lower.includes("thermo"))
    return "Thermodynamics ke niyam:\n• Pahla niyam: ΔU = Q − W (energy conservation)\n• Doosra niyam: Entropy hamesha badhti hai\n• Teesra niyam: Absolute zero par entropy zero hoti hai\n\n📚 NCERT Physics Class 11, Chapter 12";
  if (lower.includes("photosynthesis") || lower.includes("prakash"))
    return "Prakash-Sansleshan (Photosynthesis):\n6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂\n\nChloroplasts mein hoti hai. Thylakoids mein light reactions, stroma mein Calvin cycle.\n\n📚 NCERT Biology Class 11, Chapter 13";
  return `Aapka sawaal tha: "${q}"\n\nYeh bahut achha sawaal hai! Is topic ke liye NCERT ki relevant chapter review karein aur Practice tab mein is topic par MCQ practice karein!\n\n💡 Tip: Backend connected hone par aur behtar jawab milega.`;
}