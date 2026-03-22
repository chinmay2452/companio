import { useState } from "react";
import { generateQuestions, submitAnswer, DEMO_USER } from "../lib/api";

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "History", "Polity"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Fallback questions when backend isn't ready
const FALLBACK = [
  { id:"q1", question:"A body of mass 2 kg moves at 10 m/s. Its kinetic energy is?", options:["50 J","100 J","200 J","25 J"], answer:"100 J", explanation:"KE = ½mv² = ½×2×100 = 100 J" },
  { id:"q2", question:"What is the SI unit of electric charge?", options:["Ampere","Volt","Coulomb","Ohm"], answer:"Coulomb", explanation:"Coulomb (C) is the SI unit of electric charge, named after Charles-Augustin de Coulomb." },
  { id:"q3", question:"State Newton's Second Law of Motion.", options:["F = mv","F = ma","F = m/a","F = v/t"], answer:"F = ma", explanation:"Newton's 2nd Law: Force = mass × acceleration. More mass or more acceleration = more force needed." },
];

const CARD = { background:"#111829", border:"1px solid #1a2840", borderRadius:12, padding:"20px" };

export default function Practice() {
  const [subject,    setSubject]    = useState("Physics");
  const [topic,      setTopic]      = useState("Newton's Laws");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questions,  setQuestions]  = useState(null);
  const [qIdx,       setQIdx]       = useState(0);
  const [selected,   setSelected]   = useState(null);
  const [revealed,   setRevealed]   = useState(false);
  const [stats,      setStats]      = useState({ correct:0, wrong:0 });
  const [startTime,  setStartTime]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [weakFlag,   setWeakFlag]   = useState(false);

  const loadQuestions = async () => {
    setLoading(true);
    setQIdx(0); setSelected(null); setRevealed(false);
    setStats({ correct:0, wrong:0 }); setWeakFlag(false);
    try {
      const res = await generateQuestions(subject, topic, difficulty);
      setQuestions(res.data?.questions || FALLBACK);
    } catch {
      setQuestions(FALLBACK);
    }
    setStartTime(Date.now());
    setLoading(false);
  };

  const qs = questions || [];
  const q  = qs[qIdx];

  const handleSelect = async (opt) => {
    if (revealed) return;
    setSelected(opt);
    setRevealed(true);
    const correct = opt === q.answer;
    const timeSec = Math.round((Date.now() - startTime) / 1000);
    const newStats = { correct: stats.correct + (correct?1:0), wrong: stats.wrong + (correct?0:1) };
    setStats(newStats);
    if (!correct && newStats.wrong >= 2) setWeakFlag(true);
    try { await submitAnswer(DEMO_USER, q.id, correct, timeSec); } catch {}
  };

  const nextQ = () => {
    setQIdx(i => i + 1);
    setSelected(null);
    setRevealed(false);
    setStartTime(Date.now());
  };

  const accuracy = (stats.correct + stats.wrong) > 0
    ? Math.round(stats.correct / (stats.correct + stats.wrong) * 100) : 0;

  return (
    <div style={{ padding:"28px 32px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, marginBottom:4 }}>🎯 Adaptive Practice</h1>
      <p style={{ color:"#4a5a80", fontSize:13, marginBottom:24 }}>AI detects your weak areas from accuracy + response time</p>

      {/* Stats */}
      <div style={{ display:"flex", gap:14, marginBottom:20 }}>
        {[
          { label:"Correct",  value:stats.correct, color:"#00e5a0" },
          { label:"Wrong",    value:stats.wrong,   color:"#ff4d6d" },
          { label:"Accuracy", value:`${accuracy}%`,color: accuracy>70?"#00e5a0":"#ffd166" },
        ].map((s,i) => (
          <div key={i} style={{ ...CARD, flex:1 }}>
            <div style={{ fontSize:11, color:"#4a5a80", textTransform:"uppercase", letterSpacing:1.5 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1, marginTop:4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ ...CARD, marginBottom:20, display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:120 }}>
          <div style={{ fontSize:11, color:"#4a5a80", marginBottom:4 }}>Subject</div>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={selectStyle}>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex:2, minWidth:180 }}>
          <div style={{ fontSize:11, color:"#4a5a80", marginBottom:4 }}>Topic</div>
          <input value={topic} onChange={e=>setTopic(e.target.value)} style={inputStyle} placeholder="e.g. Newton's Laws" />
        </div>
        <div style={{ flex:1, minWidth:100 }}>
          <div style={{ fontSize:11, color:"#4a5a80", marginBottom:4 }}>Difficulty</div>
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} style={selectStyle}>
            {DIFFICULTIES.map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={loadQuestions} disabled={loading} style={btnStyle}>
          {loading?"Loading…":"Generate Questions"}
        </button>
      </div>

      {/* Question */}
      {q && (
        <div style={CARD}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <span style={{ background:"#7c6fff22", color:"#7c6fff", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>
              Q{qIdx+1}/{qs.length}
            </span>
            <span style={{ background:"#1a2840", color:"#4a5a80", fontSize:11, padding:"2px 8px", borderRadius:4 }}>
              {subject} · {difficulty}
            </span>
          </div>

          <div style={{ fontSize:16, fontWeight:600, lineHeight:1.6, marginBottom:20 }}>{q.question}</div>

          {q.options.map((opt,i)=>{
            let bg="#131e35", border="1px solid #1a2840", color="#e8eaf6";
            if(revealed){
              if(opt===q.answer){ bg="#00e5a014"; border="1px solid #00e5a0"; color="#00e5a0"; }
              else if(opt===selected){ bg="#ff4d6d14"; border="1px solid #ff4d6d"; color="#ff4d6d"; }
            }
            return (
              <div key={i} onClick={()=>handleSelect(opt)} style={{
                padding:"12px 16px", borderRadius:8, border, background:bg, color,
                cursor:revealed?"default":"pointer", marginBottom:8, fontSize:13,
                transition:"all 0.2s",
              }}>
                <span style={{ fontFamily:"monospace", marginRight:10, opacity:0.6 }}>{String.fromCharCode(65+i)}.</span>
                {opt}
              </div>
            );
          })}

          {revealed && (
            <div style={{ marginTop:14, padding:"12px 16px", background:"#131e35", borderRadius:8, border:"1px solid #1a2840" }}>
              <div style={{ fontSize:12, fontWeight:700, color:selected===q.answer?"#00e5a0":"#ff4d6d", marginBottom:4 }}>
                {selected===q.answer?"✅ Correct!":"❌ Wrong — Correct answer: "+q.answer}
              </div>
              <div style={{ fontSize:12, color:"#4a5a80" }}>{q.explanation}</div>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:14 }}>
            <span style={{ fontSize:12, color:"#4a5a80" }}>
              {revealed && selected!==q.answer ? "⚠️ This will be added to your revision queue" : ""}
            </span>
            {revealed && qIdx < qs.length-1 && (
              <button onClick={nextQ} style={btnStyle}>Next Question →</button>
            )}
            {revealed && qIdx === qs.length-1 && (
              <button onClick={loadQuestions} style={{ ...btnStyle, background:"#00e5a022", color:"#00e5a0", border:"1px solid #00e5a044" }}>
                🔄 New Set
              </button>
            )}
          </div>
        </div>
      )}

      {!q && !loading && (
        <div style={{ ...CARD, textAlign:"center", padding:"40px 20px", color:"#4a5a80" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
          <p>Select a subject and topic, then click "Generate Questions"</p>
        </div>
      )}

      {/* Weakness alert */}
      {weakFlag && (
        <div style={{ ...CARD, marginTop:16, borderColor:"#ff4d6d44" }}>
          <div style={{ color:"#ff4d6d", fontWeight:700, marginBottom:8 }}>⚠️ Weakness Detected by AI</div>
          <p style={{ fontSize:13, color:"#4a5a80" }}>
            Pattern of errors in <strong style={{ color:"#e8eaf6" }}>{subject} — {topic}</strong>. 
            The planner will automatically increase revision frequency for this topic.
            Targeted questions queued.
          </p>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width:"100%", background:"#131e35", border:"1px solid #1a2840",
  borderRadius:8, color:"#e8eaf6", fontSize:13, padding:"9px 12px", outline:"none",
};
const inputStyle = {
  ...selectStyle, fontFamily:"inherit",
};
const btnStyle = {
  background:"#7c6fff", color:"#fff", border:"none",
  borderRadius:8, padding:"10px 18px", fontSize:13,
  fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
};