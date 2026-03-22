import { useState } from "react";
import useAppStore from "../store/useAppStore";
import { supabase } from "../lib/supabaseClient";

const EXAMS = [
  { id: "JEE",  icon: "📐", label: "JEE Main/Advanced", desc: "Engineering" },
  { id: "NEET", icon: "🧬", label: "NEET-UG", desc: "Medical" },
  { id: "UPSC", icon: "🏛️", label: "UPSC CSE", desc: "Civil Services" },
];

export default function Onboarding({ onComplete }) {
  const [name, setName] = useState("");
  const [exam, setExam] = useState("");
  const session = useAppStore((s) => s.session);
  const setUser = useAppStore((s) => s.setUser);
  const setExamTypeStore = useAppStore((s) => s.setExamType);
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!exam) {
      setError("Please select your target exam.");
      return;
    }

    const userId = session?.user?.id;

    // Save name + exam to Supabase user metadata
    try {
      await supabase.auth.updateUser({
        data: { name: name.trim(), exam_type: exam },
      });
    } catch (e) {
      console.error("Failed to update user metadata:", e);
    }

    // Update global store with real user ID
    setUser({
      id: userId,
      name: name.trim(),
      exam_type: exam,
      exam_date: null,
    });
    setExamTypeStore(exam);

    onComplete();
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: "#0d1526", border: "1px solid #1a2840",
        borderRadius: 16, padding: "40px 48px", width: "100%", maxWidth: 480,
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "Georgia", fontWeight: 700, fontSize: 32, letterSpacing: -0.5 }}>
            Compan<span style={{ color: "#7c6fff" }}>io</span> AI
          </div>
          <div style={{ fontSize: 11, color: "#4a5a80", letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>
            Your Personal Study Agent
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8eaf6", marginBottom: 8 }}>
            What should I call you?
          </label>
          <input
            type="text"
            placeholder="e.g. Radhika"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            style={{
              width: "100%", padding: "12px 16px", background: "#131e35",
              border: "1px solid #1a2840", borderRadius: 8, color: "#fff",
              fontSize: 15, outline: "none", boxSizing: "border-box",
              transition: "border 0.2s"
            }}
            onFocus={(e) => e.target.style.borderColor = "#7c6fff"}
            onBlur={(e) => e.target.style.borderColor = "#1a2840"}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#e8eaf6", marginBottom: 12 }}>
            Which exam are you preparing for?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {EXAMS.map(ext => (
              <div
                key={ext.id}
                onClick={() => { setExam(ext.id); setError(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px", borderRadius: 10, cursor: "pointer",
                  background: exam === ext.id ? "#7c6fff22" : "#131e35",
                  border: `1px solid ${exam === ext.id ? "#7c6fff" : "#1a2840"}`,
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: 24 }}>{ext.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: exam === ext.id ? "#e8eaf6" : "#b0bec5", marginBottom: 2 }}>
                    {ext.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#4a5a80" }}>{ext.desc}</div>
                </div>
                {exam === ext.id && (
                  <div style={{ marginLeft: "auto", color: "#7c6fff", fontSize: 20 }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: "#ff4d6d", fontSize: 13, marginBottom: 16, textAlign: "center", background: "#ff4d6d15", padding: "8px", borderRadius: 6 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          style={{
            width: "100%", background: "linear-gradient(135deg, #7c6fff, #5a4fcf)", color: "#fff",
            border: "none", borderRadius: 8, padding: "14px", fontSize: 16,
            fontWeight: 700, cursor: "pointer", transition: "transform 0.1s, boxShadow 0.2s",
            boxShadow: "0 4px 14px rgba(124, 111, 255, 0.4)"
          }}
          onMouseDown={(e) => e.target.style.transform = "scale(0.98)"}
          onMouseUp={(e) => e.target.style.transform = "scale(1)"}
        >
          Start Studying 🚀
        </button>
      </div>
    </div>
  );
}
