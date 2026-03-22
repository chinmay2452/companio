import { useState, useEffect, useRef } from "react";

const FLASHCARDS = [
  { q:"First Law of Thermodynamics?", a:"ΔU = Q − W (Energy cannot be created or destroyed)", subject:"Physics" },
  { q:"What is Coulomb's Law?",       a:"F = kq₁q₂/r² — force between two charges",           subject:"Physics" },
  { q:"sp³ hybridisation example?",  a:"Methane (CH₄) — tetrahedral, 109.5° bond angle",      subject:"Chemistry" },
  { q:"Avogadro's Number?",          a:"6.022 × 10²³ particles per mole",                      subject:"Chemistry" },
  { q:"What is mitosis?",            a:"Cell division producing 2 identical daughter cells",   subject:"Biology" },
];

const QUICK_MCQS = [
  { q:"KE of 2 kg body at 10 m/s?", opts:["100 J","50 J","200 J","25 J"], ans:"100 J" },
  { q:"SI unit of electric charge?", opts:["Volt","Coulomb","Ampere","Ohm"], ans:"Coulomb" },
];

export default function MicroTimePage() {
  const [minutes,  setMinutes]  = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [active,   setActive]   = useState(false);
  const [phase,    setPhase]    = useState("flashcard"); // flashcard | mcq | done
  const [fcIdx,    setFcIdx]    = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [mcqIdx,   setMcqIdx]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [streak,   setStreak]   = useState(3);
  const timerRef = useRef(null);

  const start = (mins) => {
    setMinutes(mins);
    setTimeLeft(mins * 60);
    setActive(true);
    setPhase("flashcard");
    setFcIdx(0); setFlipped(false);
    setMcqIdx(0); setSelected(null);
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

  const mm = String(Math.floor(timeLeft / 60)).padStart(2,"0");
  const ss = String(timeLeft % 60).padStart(2,"0");

  const fc  = FLASHCARDS[fcIdx % FLASHCARDS.length];
  const mcq = QUICK_MCQS[mcqIdx % QUICK_MCQS.length];

  // ── Not started yet ──
  if (!active && phase !== "done") {
    return (
      <div style={{ padding:"28px 32px" }}>
        <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, marginBottom:4 }}>⚡ Micro Mode</h1>
        <p style={{ color:"#4a5a80", fontSize:13, marginBottom:24 }}>
          Use small time gaps efficiently — revision in 2, 5, or 10 minutes
        </p>

        <div style={{ display:"flex", gap:14, marginBottom:24 }}>
          {[2,5,10].map(m=>(
            <div key={m} onClick={()=>start(m)} style={{
              flex:1, background:"#111829", border:"1px solid #7c6fff44",
              borderRadius:16, padding:"28px 20px", textAlign:"center", cursor:"pointer",
              transition:"border-color 0.2s",
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#7c6fff"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="#7c6fff44"}
            >
              <div style={{ fontSize:40, fontWeight:800, color:"#7c6fff", fontFamily:"monospace" }}>{m}</div>
              <div style={{ fontSize:14, color:"#4a5a80", marginTop:4 }}>minutes</div>
              <div style={{ fontSize:11, color:"#4a5a80", marginTop:8 }}>
                {m===2?"1 flashcard + 1 quick MCQ":m===5?"3 flashcards + 1 MCQ + formula":"5 flashcards + 2 MCQs + formulas"}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"16px 20px" }}>
          <div style={{ fontSize:13, color:"#ffd166", fontWeight:700, marginBottom:8 }}>🔥 Current Streak: {streak} days</div>
          <p style={{ fontSize:12, color:"#4a5a80" }}>
            Students use Micro Mode while commuting, waiting, or during breaks.
            Even 2 minutes of spaced revision dramatically reduces forgetting.
          </p>
        </div>
      </div>
    );
  }

  // ── Done ──
  if (phase === "done") {
    return (
      <div style={{ padding:"28px 32px", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏆</div>
        <h2 style={{ fontSize:22, fontWeight:700, color:"#00e5a0", marginBottom:8 }}>Session Complete!</h2>
        <p style={{ color:"#4a5a80", fontSize:13, marginBottom:4 }}>Streak: <strong style={{ color:"#ffd166" }}>{streak+1} days</strong> 🔥</p>
        <p style={{ color:"#4a5a80", fontSize:13, marginBottom:24 }}>Your revision data has been saved.</p>
        <button onClick={()=>{setPhase("idle");setMinutes(null);setStreak(s=>s+1);}}
          style={{ background:"#7c6fff", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Start Another Session
        </button>
      </div>
    );
  }

  // ── Active session ──
  return (
    <div style={{ padding:"28px 32px" }}>
      {/* Timer */}
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:10, color:"#4a5a80", letterSpacing:2, textTransform:"uppercase" }}>⏱ Time Remaining</div>
        <div style={{ fontSize:56, fontWeight:800, color:"#7c6fff", fontFamily:"monospace", lineHeight:1.1 }}>{mm}:{ss}</div>
        <div style={{ fontSize:11, color:"#4a5a80", marginTop:4 }}>{minutes}-minute power session</div>
        <button onClick={()=>{clearInterval(timerRef.current);setActive(false);setPhase("done");}}
          style={{ marginTop:10, background:"transparent", border:"1px solid #ff4d6d44", color:"#ff4d6d", borderRadius:6, padding:"5px 14px", fontSize:12, cursor:"pointer" }}>
          End Session
        </button>
      </div>

      {/* Tab switch */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {["flashcard","mcq"].map(p=>(
          <button key={p} onClick={()=>setPhase(p)} style={{
            background: phase===p?"#7c6fff":"#131e35",
            color: phase===p?"#fff":"#4a5a80",
            border:`1px solid ${phase===p?"#7c6fff":"#1a2840"}`,
            borderRadius:6, padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600,
          }}>{p==="flashcard"?"🃏 Flashcards":"✏️ Quick MCQ"}</button>
        ))}
      </div>

      {/* Flashcard */}
      {phase==="flashcard" && (
        <>
          <div onClick={()=>setFlipped(p=>!p)} style={{
            background: flipped?"#111829":"#131e35",
            border:`1px solid ${flipped?"#7c6fff44":"#1a2840"}`,
            borderRadius:16, padding:"36px 28px", cursor:"pointer", textAlign:"center",
            minHeight:180, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            transition:"all 0.3s", marginBottom:12,
          }}>
            <div style={{ fontSize:10, color:"#4a5a80", fontFamily:"monospace", marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>
              {flipped?"ANSWER":"QUESTION — tap to reveal"}
            </div>
            <div style={{ fontSize:16, fontWeight:600, lineHeight:1.6, color: flipped?"#7c6fff":"#e8eaf6" }}>
              {flipped ? fc.a : fc.q}
            </div>
            <div style={{ fontSize:11, color:"#4a5a80", marginTop:8 }}>{fc.subject}</div>
          </div>
          <button onClick={()=>{ setFcIdx(i=>i+1); setFlipped(false); }} style={{
            width:"100%", background:"#131e35", border:"1px solid #1a2840",
            borderRadius:8, padding:"10px", fontSize:13, color:"#4a5a80", cursor:"pointer",
          }}>
            Next Card →
          </button>
        </>
      )}

      {/* MCQ */}
      {phase==="mcq" && (
        <>
          <div style={{ background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"20px", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:16, lineHeight:1.5 }}>{mcq.q}</div>
            {mcq.opts.map((opt,i)=>{
              let bg="#131e35", border="1px solid #1a2840", color="#e8eaf6";
              if(selected){ if(opt===mcq.ans){bg="#00e5a014";border="1px solid #00e5a0";color="#00e5a0";} else if(opt===selected){bg="#ff4d6d14";border="1px solid #ff4d6d";color="#ff4d6d";} }
              return (
                <div key={i} onClick={()=>!selected&&setSelected(opt)} style={{
                  padding:"10px 14px", borderRadius:8, border, background:bg, color,
                  cursor:selected?"default":"pointer", fontSize:13, marginBottom:8, transition:"all 0.2s",
                }}>{opt}</div>
              );
            })}
          </div>
          {selected && (
            <button onClick={()=>{setMcqIdx(i=>i+1);setSelected(null);}} style={{
              width:"100%", background:"#7c6fff", color:"#fff", border:"none",
              borderRadius:8, padding:"10px", fontSize:13, fontWeight:600, cursor:"pointer",
            }}>Next Question →</button>
          )}
        </>
      )}
    </div>
  );
}