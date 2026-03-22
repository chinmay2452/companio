import { useState } from "react";
import { reviewCard, DEMO_USER } from "../lib/api";

const DEMO_CARDS = [
  { id:"c1", topic:"Thermodynamics — First Law", subject:"Physics",  interval:"Due now",  ease:1.8, hint:"ΔU = Q − W" },
  { id:"c2", topic:"Hybridisation Types",        subject:"Chemistry",interval:"Due now",  ease:2.1, hint:"sp, sp², sp³" },
  { id:"c3", topic:"Mitosis vs Meiosis",         subject:"Biology",  interval:"Due now",  ease:2.5, hint:"Cell division types" },
  { id:"c4", topic:"Integration by Parts",       subject:"Maths",    interval:"Due now",  ease:1.6, hint:"∫u dv = uv − ∫v du" },
  { id:"c5", topic:"Electrostatics — Coulomb's Law",subject:"Physics",interval:"Due now", ease:2.2, hint:"F = kq₁q₂/r²" },
];

const SCORES = [
  { val:0, label:"Again",   color:"#ff4d6d", desc:"Complete blackout" },
  { val:2, label:"Hard",    color:"#ff9f43", desc:"Wrong but familiar" },
  { val:3, label:"Good",    color:"#7c6fff", desc:"Correct with effort" },
  { val:4, label:"Easy",    color:"#00d2ff", desc:"Correct, some hesitation" },
  { val:5, label:"Perfect", color:"#00e5a0", desc:"Instant recall" },
];

export default function Revisions() {
  const [cards,   setCards]   = useState(DEMO_CARDS);
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done,    setDone]    = useState([]);

  const card = cards[idx];

  const handleScore = async (quality) => {
    try { await reviewCard(DEMO_USER, card.id, quality); } catch {}
    setDone(p => [...p, card.id]);
    setFlipped(false);
    setIdx(i => i + 1);
  };

  const remaining = cards.length - idx;
  const progress  = Math.round((idx / cards.length) * 100);

  if (idx >= cards.length) {
    return (
      <div style={{ padding:"28px 32px" }}>
        <h1 style={{ fontSize:26, fontWeight:800, marginBottom:8 }}>🧠 Revisions</h1>
        <div style={{ background:"#111829", border:"1px solid #00e5a044", borderRadius:12, padding:"40px 20px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
          <h2 style={{ fontSize:22, fontWeight:700, color:"#00e5a0", marginBottom:8 }}>All cards reviewed!</h2>
          <p style={{ color:"#4a5a80", fontSize:13 }}>Great session. Your spaced repetition intervals have been updated.</p>
          <button onClick={()=>{ setIdx(0); setFlipped(false); setDone([]); }}
            style={{ marginTop:20, background:"#7c6fff", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Restart Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"28px 32px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, marginBottom:4 }}>🧠 Spaced Repetition Cards</h1>
      <p style={{ color:"#4a5a80", fontSize:13, marginBottom:20 }}>
        SM-2 algorithm — forgetting curve based revision scheduling
      </p>

      {/* Progress */}
      <div style={{ background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"14px 20px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:12 }}>Session Progress</span>
          <span style={{ fontSize:12, color:"#7c6fff", fontFamily:"monospace" }}>{idx}/{cards.length} cards · {remaining} remaining</span>
        </div>
        <div style={{ height:6, background:"#1a2840", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#7c6fff", width:`${progress}%`, borderRadius:3, transition:"width 0.4s" }} />
        </div>
      </div>

      {/* Flip card */}
      <div onClick={()=>setFlipped(p=>!p)} style={{
        background: flipped?"#111829":"#131e35",
        border:`1px solid ${flipped?"#7c6fff44":"#1a2840"}`,
        borderRadius:16, padding:"36px 32px", cursor:"pointer",
        textAlign:"center", marginBottom:20, minHeight:200,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        transition:"all 0.3s",
      }}>
        <div style={{ fontSize:10, color:"#4a5a80", fontFamily:"monospace", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>
          {flipped ? "ANSWER — tap to flip back" : "QUESTION — tap to reveal answer"}
        </div>

        {!flipped ? (
          <>
            <div style={{ fontSize:20, fontWeight:700, lineHeight:1.5, marginBottom:12 }}>{card.topic}</div>
            <div style={{ fontSize:12, color:"#4a5a80" }}>{card.subject}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize:16, color:"#7c6fff", fontWeight:600, marginBottom:8 }}>{card.hint}</div>
            <div style={{ fontSize:13, color:"#4a5a80" }}>Subject: {card.subject}</div>
            <div style={{ fontSize:12, color:"#4a5a80", marginTop:6 }}>Next review: based on your score below</div>
          </>
        )}
      </div>

      {/* Score buttons — only show after flip */}
      {flipped && (
        <div>
          <div style={{ fontSize:12, color:"#4a5a80", marginBottom:10, textAlign:"center" }}>
            How well did you remember this?
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {SCORES.map(sc=>(
              <button key={sc.val} onClick={()=>handleScore(sc.val)} style={{
                flex:1, minWidth:90,
                background:`${sc.color}18`, color:sc.color,
                border:`1px solid ${sc.color}44`, borderRadius:8,
                padding:"10px 8px", cursor:"pointer", textAlign:"center",
              }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{sc.label}</div>
                <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>{sc.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!flipped && (
        <div style={{ textAlign:"center", color:"#4a5a80", fontSize:12 }}>
          👆 Tap the card to reveal the answer
        </div>
      )}
    </div>
  );
}