import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Practice from "./pages/Practice";
import TutorChat from "./pages/TutorChat";
import Revisions from "./pages/Revisions";
import MicroTimeMode from "./components/microtime/MicroTimeMode";
import VoiceHindiTutor from "./components/voice/VoiceHindiTutor";
import Onboarding from "./pages/Onboarding";
import useAppStore from "./store/useAppStore";

const NAV = [
  { id: "dashboard",  label: "Dashboard",     icon: "◈" },
  { id: "revisions",  label: "Revisions",     icon: "🧠" },
  { id: "practice",   label: "Practice",      icon: "🎯" },
  { id: "tutor",      label: "AI Tutor",      icon: "💬" },
  { id: "voice",      label: "Hindi Tutor",   icon: "🎙️" },
  { id: "micro",      label: "Micro Mode ⚡",  icon: "⚡" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const isOnboarded = useAppStore(s => s.isOnboarded);
  const examType = useAppStore(s => s.examType) || "JEE";
  const setOnboarded = useAppStore(s => s.setOnboarded);

  if (!isOnboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1e" }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0, background: "#0d1526",
        borderRight: "1px solid #1a2840", display: "flex",
        flexDirection: "column", position: "sticky", top: 0, height: "100vh"
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #1a2840" }}>
          <div style={{ fontFamily: "Georgia", fontWeight: 700, fontSize: 22, letterSpacing: -0.5 }}>
            Compan<span style={{ color: "#7c6fff" }}>io</span> AI
          </div>
          <div style={{ fontSize: 10, color: "#4a5a80", letterSpacing: 2, marginTop: 3, textTransform: "uppercase" }}>
            Learning Companion
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0" }}>
          <div style={{ padding: "6px 20px 3px", fontSize: 10, color: "#4a5a80", letterSpacing: 2, textTransform: "uppercase" }}>
            Navigation
          </div>
          {NAV.map(n => (
            <div key={n.id}
              onClick={() => setTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 20px", cursor: "pointer", fontSize: 13,
                color: tab === n.id ? "#e8eaf6" : "#4a5a80",
                background: tab === n.id ? "linear-gradient(90deg,#7c6fff18,transparent)" : "transparent",
                borderLeft: `2px solid ${tab === n.id ? "#7c6fff" : "transparent"}`,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              {n.label}
            </div>
          ))}
        </nav>

        {/* Exam badge */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a2840" }}>
          <div style={{ background: "#131e35", border: "1px solid #1a2840", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: "#4a5a80", textTransform: "uppercase", letterSpacing: 1 }}>Target</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{examType} 2026</div>
            <div style={{ fontSize: 11, color: "#ff6b9d", marginTop: 2 }}>📅 127 days left</div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "revisions"  && <Revisions />}
        {tab === "practice"   && <Practice />}
        {tab === "tutor"      && <TutorChat />}
        {tab === "voice"      && <VoiceHindiTutor />}
        {tab === "micro"      && <MicroTimeMode />}
      </div>
    </div>
  );
}