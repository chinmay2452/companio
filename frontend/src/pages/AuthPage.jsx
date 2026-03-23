import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* ── Design Tokens ────────────────────────────────────────────── */
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
  borderRadius: 16,
  ...extra,
});

const EXAM_TYPES = ["JEE", "NEET", "UPSC", "Other"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const SUBJECTS_LIST = ["Physics", "Chemistry", "Maths", "Biology", "History", "Polity", "Geography", "Economics"];

export default function AuthPage() {
  const [mode, setMode] = useState("signup"); // "login" | "signup"
  
  // Base fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  
  // Extended profile fields
  const [examType, setExamType] = useState("JEE");
  const [targetYear, setTargetYear] = useState("2026");
  const [studyGoal, setStudyGoal] = useState("4");
  const [level, setLevel] = useState("Intermediate");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const toggleSubject = (sub) => {
    setSelectedSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccessMsg(""); setLoading(true);

    try {
      if (mode === "signup") {
        if (selectedSubjects.length === 0) throw new Error("Please select at least one preferred subject.");
        
        // 1. Sign up with Supabase Auth
        const { data: authData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              exam_type: examType,
              exam_date: targetYear, 
              study_goal: parseInt(studyGoal, 10),
              level: level,
            },
          },
        });
        if (signUpErr) throw signUpErr;
        
        const user = authData?.user;
        if (!user || user.identities?.length === 0) {
          throw new Error("An account with this email already exists.");
        }

        // 2. Insert into basic 'users' table
        const { error: dbErr } = await supabase.from('users').insert([{
          id: user.id,
          email: user.email,
          name: name.trim(),
          exam_type: examType,
          target_year: parseInt(targetYear, 10),
          daily_goal_hours: parseInt(studyGoal, 10),
          preferred_subjects: selectedSubjects,
          current_level: level
        }]);
        
        // If DB insert fails due to missing table/columns, we silently ignore for now 
        // as the user is already authenticated in Supabase Auth.
        if (dbErr) console.warn("Notice: users table insert failed (schema missing?). Auth succeeded.", dbErr);

        setSuccessMsg("Account created automatically syncing... Redirecting!");
        // We let the App.jsx onAuthStateChange handle the redirect.
      } else {
        // Sign In
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes fade-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes brain-pulse { 0%,100%{filter:drop-shadow(0 0 15px ${C.primary}33)} 50%{filter:drop-shadow(0 0 35px ${C.primary}88)} }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px ${C.surfaceTop} inset !important;
            -webkit-text-fill-color: white !important;
        }
        .form-input {
          width: 100%; background: ${C.surfaceTop}; border: 1px solid ${C.outline}44; border-radius: 10px;
          color: ${C.textPrimary}; font-size: 13px; padding: 12px 14px; outline: none; transition: all 0.2s;
        }
        .form-input:focus { border-color: ${C.primary}88; box-shadow: 0 0 0 3px ${C.primary}22; }
        .form-label { display: block; font-size: 10px; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 700; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.outline}88; border-radius: 2px; }
      `}</style>
      
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", fontFamily: "Inter,sans-serif", color: C.textPrimary }}>
        
        {/* ── Left side (Hero) ────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 8%", position: "relative", overflow: "hidden" }}>
          
          {/* Background decoration */}
          <div style={{ position: "absolute", top: "20%", left: "10%", width: "40vw", height: "40vw", background: `radial-gradient(circle, ${C.primaryDim}15 0%, transparent 60%)`, filter: "blur(60px)", zIndex: 0 }} />
          
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${C.secondary}15`, border: `1px solid ${C.secondary}44`, borderRadius: 20, padding: "5px 12px", marginBottom: 24, animation: "fade-in 0.4s ease" }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: "uppercase", letterSpacing: 1 }}>Now available for JEE & NEET</span>
            </div>

            <h1 style={{ fontSize: 52, fontWeight: 800, fontFamily: "Manrope,sans-serif", letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 20, animation: "fade-in 0.5s ease" }}>
              Compan<span style={{ color: C.primary }}>io</span> AI
              <br />
              <span style={{ color: C.textPrimary }}>Your Smart Exam Companion.</span>
            </h1>
            
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.6, maxWidth: 480, marginBottom: 40, animation: "fade-in 0.6s ease" }}>
              Adaptive revision, AI-powered tutoring, and micro-learning sessions built specifically for competitive exams like JEE, NEET, and UPSC.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fade-in 0.7s ease" }}>
              {[
                { icon: "🧠", title: "Spaced Repetition", desc: "Never forget what you studied." },
                { icon: "💬", title: "AI Tutor",          desc: "Instant answers grounded in NCERT." },
                { icon: "🎯", title: "Adaptive Practice", desc: "Focuses on your weakest topics." },
                { icon: "⚡", title: "Micro-Time Learning",desc: "High-impact sessions for busy days." }
              ].map((ft, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surfaceTop, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `1px solid ${C.outline}33` }}>
                    {ft.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{ft.title}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{ft.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right side (Auth Form) ───────────────────────────── */}
        <div style={{ width: 520, background: C.surface, borderLeft: `1px solid ${C.outline}33`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 60px", boxShadow: `-20px 0 60px rgba(0,0,0,0.5)`, zIndex: 2 }}>
          
          <div style={{ ...glass({ padding: "32px 36px", maxHeight: "85vh", overflowY: "auto", overflowX: "hidden" }), animation: "fade-in 0.4s ease" }}>
            
            <div style={{ display: "flex", background: C.surfaceTop, borderRadius: 12, padding: 4, marginBottom: 32 }}>
              {["signup", "login"].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccessMsg(""); }}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", transition: "all 0.2s",
                    background: mode === m ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})` : "transparent",
                    color: mode === m ? "#fff" : C.textMuted,
                    boxShadow: mode === m ? `0 4px 12px ${C.primary}44` : "none",
                  }}>
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: "Manrope,sans-serif", marginBottom: 6 }}>
              {mode === "login" ? "Welcome Back 👋" : "Create Account 🚀"}
            </h2>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {mode === "login" ? "Sign in to pick up where you left off." : "Fill in your details to get your personalized study plan."}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {mode === "signup" && (
                <div style={{ animation: "fade-in 0.2s ease" }}>
                  <label className="form-label">Full Name</label>
                  <input className="form-input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Radhika Sharma" required />
                </div>
              )}

              <div>
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>

              <div>
                <label className="form-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input className="form-input" type={showPwd ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"} required minLength={6} style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14 }}>
                    {showPwd ? "🐵" : "🙈"}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" style={{ accentColor: C.primary }} /> Remember me
                  </label>
                  <a href="#" style={{ fontSize: 12, color: C.primary, textDecoration: "none", fontWeight: 600 }}>Forgot password?</a>
                </div>
              )}

              {/* Extended Profile Setup (Only on Signup) */}
              {mode === "signup" && (
                <div style={{ marginTop: 8, paddingTop: 20, borderTop: `1px solid ${C.outline}44`, display: "flex", flexDirection: "column", gap: 16, animation: "fade-in 0.3s ease" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Exam Profile Setup</div>
                  
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Exam Type</label>
                      <select className="form-input" value={examType} onChange={e=>setExamType(e.target.value)}>
                        {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Target Year</label>
                      <input className="form-input" type="number" value={targetYear} onChange={e=>setTargetYear(e.target.value)} min="2024" max="2030" required />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Daily Goal (Hours)</label>
                      <input className="form-input" type="number" value={studyGoal} onChange={e=>setStudyGoal(e.target.value)} min="1" max="16" required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Current Level</label>
                      <select className="form-input" value={level} onChange={e=>setLevel(e.target.value)}>
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Preferred Subjects (Select multiple)</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {SUBJECTS_LIST.map(sub => {
                        const active = selectedSubjects.includes(sub);
                        return (
                          <div key={sub} onClick={() => toggleSubject(sub)}
                            style={{
                              padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                              background: active ? `${C.primary}22` : C.surfaceTop,
                              border: active ? `1px solid ${C.primary}66` : `1px solid ${C.outline}44`,
                              color: active ? C.primary : C.textMuted,
                            }}>
                            {sub}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {error && (
                <div style={{ background: `${C.error}15`, border: `1px solid ${C.error}44`, borderRadius: 8, padding: "10px", fontSize: 12, color: C.error, textAlign: "center", animation: "fade-in 0.2s" }}>
                  ⚠️ {error}
                </div>
              )}
              {successMsg && (
                <div style={{ background: `${C.secondary}15`, border: `1px solid ${C.secondary}44`, borderRadius: 8, padding: "10px", fontSize: 12, color: C.secondary, textAlign: "center", animation: "fade-in 0.2s" }}>
                  ✅ {successMsg}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{
                  marginTop: 10, padding: "14px", borderRadius: 10, border: "none", width: "100%",
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDim})`, color: "#fff",
                  fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                  boxShadow: `0 4px 20px ${C.primary}44`, transition: "all 0.2s",
                }}>
                {loading ? (
                   <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                     <div style={{ width: 14, height: 14, border: "2px solid #fff4", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                     {mode === "login" ? "Signing in..." : "Creating account..."}
                   </span>
                ) : (
                  mode === "login" ? "Sign In →" : "Create Account 🚀"
                )}
              </button>

            </form>
          </div>

        </div>
      </div>
    </>
  );
}
