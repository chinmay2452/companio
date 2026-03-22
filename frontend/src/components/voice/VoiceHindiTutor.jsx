import React, { useState, useRef, useEffect } from "react";
import { askTutorHindi } from "../../lib/api";
import { useUser } from "../../store/useAppStore";

// States: idle | listening | thinking | speaking
const STATE_CONFIG = {
  idle:      { color:"#4a5a80", pulse:false, label:"Press to speak",     bg:"#131e35", border:"#1a2840" },
  listening: { color:"#ff4d6d", pulse:true,  label:"Listening…",         bg:"#ff4d6d18", border:"#ff4d6d" },
  thinking:  { color:"#ffd166", pulse:false, label:"Thinking…",          bg:"#ffd16618", border:"#ffd166" },
  speaking:  { color:"#00e5a0", pulse:false, label:"Speaking answer…",   bg:"#00e5a018", border:"#00e5a0" },
};

const HISTORY_MAX = 5;

export default function VoiceHindiTutor() {
  const user = useUser();
  const [state,     setState]   = useState("idle");
  const [history,   setHistory] = useState([]);
  const [lastQ,     setLastQ]   = useState("");
  const [lastA,     setLastA]   = useState("");
  const [lang,      setLang]    = useState("hi-IN"); // hi-IN or en-IN
  const [error,     setError]   = useState("");
  const recognitionRef = useRef(null);
  const utteranceRef   = useRef(null);

  const cfg = STATE_CONFIG[state];

  const startListening = () => {
    setError("");
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Your browser doesn't support voice input. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart  = () => setState("listening");
    recognition.onerror  = () => { setState("idle"); setError("Mic error — please allow microphone access"); };

    recognition.onresult = async (e) => {
      const question = e.results[0][0].transcript;
      setLastQ(question);
      setState("thinking");

      // Keep history for multi-turn context
      const recentHistory = history.slice(-HISTORY_MAX);

      let answer = "";
      try {
        const res = await askTutorHindi(question, recentHistory, "General", user?.id);
        answer = res.data?.answer || res.data?.response || "";
      } catch (err) {
        console.error("AI Tutor fell back to offline mode:", err);
        // Fallback offline answers in Hindi
        answer = getHindiAnswer(question);
      }

      setLastA(answer);
      setHistory(h => [...h, { role:"user", text:question }, { role:"ai", text:answer }]);

      // Speak the answer
      setState("speaking");
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.onend = () => setState("idle");
      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    recognition.start();
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setState("idle");
  };

  const handleMicClick = () => {
    if (state === "idle")      startListening();
    else if (state === "listening") { recognitionRef.current?.stop(); setState("idle"); }
    else if (state === "speaking")  stopSpeaking();
  };

  const replay = () => {
    if (!lastA) return;
    setState("speaking");
    const utterance = new SpeechSynthesisUtterance(lastA);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onend = () => setState("idle");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, marginBottom:4 }}>🎙️ Hindi Voice Tutor</h1>
      <p style={{ color:"#4a5a80", fontSize:13, marginBottom:6 }}>
        Speak your doubt in Hindi or Hinglish — AI answers aloud in your language
      </p>
      <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#00e5a018", border:"1px solid #00e5a044", borderRadius:6, padding:"3px 10px", marginBottom:24 }}>
        <span style={{ fontSize:10, fontWeight:700, color:"#00e5a0" }}>+5 BONUS POINTS</span>
      </div>

      {/* Language toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        <button onClick={()=>setLang("hi-IN")} style={{
          background: lang==="hi-IN"?"#7c6fff":"#131e35",
          color: lang==="hi-IN"?"#fff":"#4a5a80",
          border:`1px solid ${lang==="hi-IN"?"#7c6fff":"#1a2840"}`,
          borderRadius:6, padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600,
        }}>🇮🇳 Hindi</button>
        <button onClick={()=>setLang("en-IN")} style={{
          background: lang==="en-IN"?"#7c6fff":"#131e35",
          color: lang==="en-IN"?"#fff":"#4a5a80",
          border:`1px solid ${lang==="en-IN"?"#7c6fff":"#1a2840"}`,
          borderRadius:6, padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600,
        }}>🗣 Hinglish</button>
      </div>

      {/* BIG mic button */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 }}>
        <div
          onClick={handleMicClick}
          style={{
            width:120, height:120, borderRadius:"50%",
            background: cfg.bg,
            border:`3px solid ${cfg.border}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", fontSize:44,
            boxShadow: cfg.pulse ? `0 0 0 12px ${cfg.color}22, 0 0 0 24px ${cfg.color}11` : "none",
            transition:"all 0.3s",
            animation: cfg.pulse ? "pulse 1s ease-in-out infinite" : "none",
          }}
        >
          {state === "idle"      && "🎙️"}
          {state === "listening" && "🔴"}
          {state === "thinking"  && "⏳"}
          {state === "speaking"  && "🔊"}
        </div>

        <div style={{ marginTop:14, fontSize:14, color:cfg.color, fontWeight:600, textAlign:"center" }}>
          {cfg.label}
        </div>

        <div style={{ fontSize:11, color:"#4a5a80", marginTop:6, textAlign:"center", maxWidth:280 }}>
          {state==="idle"?"Click the mic and speak your doubt"
          :state==="listening"?"Speaking… click again to stop"
          :state==="thinking"?"Groq AI is preparing your answer"
          :"Answering aloud — click to stop"}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 12px #ff4d6d22,0 0 0 24px #ff4d6d11}50%{box-shadow:0 0 0 18px #ff4d6d33,0 0 0 32px #ff4d6d18}}`}</style>

      {/* Error */}
      {error && (
        <div style={{ background:"#ff4d6d18", border:"1px solid #ff4d6d44", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#ff4d6d", marginBottom:16, textAlign:"center" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Current Q&A */}
      {(lastQ || lastA) && (
        <div style={{ background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
          {lastQ && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#4a5a80", fontFamily:"monospace", marginBottom:6 }}>YOU ASKED</div>
              <div style={{ fontSize:14, color:"#e8eaf6", fontStyle:"italic" }}>"{lastQ}"</div>
            </div>
          )}
          {lastA && (
            <div>
              <div style={{ fontSize:10, color:"#7c6fff", fontFamily:"monospace", marginBottom:6 }}>AI ANSWER</div>
              <div style={{ fontSize:13, color:"#e8eaf6", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{lastA}</div>
              <button onClick={replay} style={{
                marginTop:10, background:"transparent", border:"1px solid #7c6fff44",
                color:"#7c6fff", borderRadius:6, padding:"5px 12px", fontSize:11, cursor:"pointer",
              }}>
                🔁 Replay Answer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Conversation history */}
      {history.length > 2 && (
        <div style={{ background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"16px 20px" }}>
          <div style={{ fontSize:11, color:"#4a5a80", fontFamily:"monospace", marginBottom:12 }}>CONVERSATION HISTORY</div>
          {history.slice(-6).map((m,i)=>(
            <div key={i} style={{
              alignSelf: m.role==="user"?"flex-end":"flex-start",
              padding:"7px 12px", borderRadius:8, fontSize:12,
              background: m.role==="user"?"#7c6fff22":"#131e35",
              border:`1px solid ${m.role==="user"?"#7c6fff44":"#1a2840"}`,
              color:"#e8eaf6", marginBottom:6,
            }}>
              <span style={{ fontSize:10, color:"#4a5a80", marginRight:8 }}>
                {m.role==="user"?"YOU:":"AI:"}
              </span>
              {m.text}
            </div>
          ))}
          <button onClick={()=>setHistory([])} style={{
            marginTop:6, background:"transparent", border:"none", color:"#4a5a80", fontSize:11, cursor:"pointer"
          }}>Clear history</button>
        </div>
      )}

      {/* How it works */}
      <div style={{ background:"#131e35", border:"1px solid #1a2840", borderRadius:12, padding:"16px 20px", marginTop:16 }}>
        <div style={{ fontSize:11, color:"#4a5a80", fontFamily:"monospace", marginBottom:10 }}>HOW IT WORKS</div>
        {[
          ["🎙️ Voice Input (STT)",   "Browser's Web Speech API captures your Hindi/Hinglish speech — no extra library needed"],
          ["🤖 Groq AI Processing",  "Groq LLaMA-3 generates a Hinglish response in under 500ms using NCERT-grounded RAG"],
          ["🔊 Voice Output (TTS)",  "Browser's SpeechSynthesis API reads the answer aloud in Hindi — works offline for cached Q&As"],
        ].map(([title,desc],i)=>(
          <div key={i} style={{ display:"flex", gap:12, marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:600, minWidth:180, color:"#e8eaf6" }}>{title}</div>
            <div style={{ fontSize:12, color:"#4a5a80", lineHeight:1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Offline Hindi fallback
function getHindiAnswer(q) {
  const lower = q.toLowerCase();
  if (lower.includes("newton") || lower.includes("nyuton")) {
    return "Newton ke teen niyam hain:\n1. Pahla niyam: Koi bhi vastu tab tak apni avastha mein rehti hai jab tak usp par baahari bal na lage.\n2. Doosra niyam: F = ma — yani Force barabar mass aur acceleration ka product.\n3. Teesra niyam: Har kriya ki pratikriya hoti hai jo barabar aur ulti disha mein hoti hai.\n\n📚 NCERT Physics Class 11, Chapter 5";
  }
  if (lower.includes("thermodynamics") || lower.includes("thermo")) {
    return "Thermodynamics ke niyam:\n• Pahla niyam: ΔU = Q − W — energy na banti hai, na nashi hoti\n• Doosra niyam: Entropy hamesha badhti hai\n• Teesra niyam: Absolute zero par entropy zero hoti hai\n\n📚 NCERT Physics Class 11, Chapter 12";
  }
  if (lower.includes("photosynthesis") || lower.includes("prakash")) {
    return "Prakash-Sansleshan — Photosynthesis:\n6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂\n\nYeh process chloroplasts mein hoti hai. Thylakoids mein light reactions, aur stroma mein Calvin cycle hoti hai.\n\n📚 NCERT Biology Class 11, Chapter 13";
  }
  return `Aapka sawaal tha: "${q}"\n\nYeh ek bahut achha sawaal hai! Is topic ke liye NCERT ki relevant chapter review karein. Main abhi internet se connected nahin hoon, lekin Practice tab mein jakar is topic par MCQ practice kar sakte hain!\n\n💡 Tip: Apna sawaal dobara puchein jab backend connected ho.`;
}