import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim() },
          },
        });
        if (signUpErr) throw signUpErr;
        if (data?.user?.identities?.length === 0) {
          setError("An account with this email already exists.");
        } else {
          setSuccessMsg("Account created! You can now sign in.");
          setMode("login");
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        // Auth state change listener in useAppStore will handle the rest
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Georgia" }}>
            Compan<span className="text-accent-purple">io</span> AI
          </h1>
          <p className="text-muted text-xs uppercase tracking-[3px] mt-1.5">Your Personal Study Agent</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-500 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {/* Mode Toggle */}
          <div className="flex gap-1 mb-7 bg-surface-700 rounded-xl p-1">
            {["login", "signup"].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setSuccessMsg(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-accent-purple text-white shadow-lg shadow-accent-purple/20"
                    : "text-muted hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <div className="animate-fade-in">
                <label className="block text-[11px] text-muted font-bold uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Radhika"
                  required
                  className="w-full bg-surface-600 border border-surface-500 rounded-lg text-sm text-white px-4 py-3 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[11px] text-muted font-bold uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-600 border border-surface-500 rounded-lg text-sm text-white px-4 py-3 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] text-muted font-bold uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                required
                minLength={6}
                className="w-full bg-surface-600 border border-surface-500 rounded-lg text-sm text-white px-4 py-3 outline-none focus:border-accent-purple/60 transition-colors placeholder:text-muted/60"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="animate-fade-in text-accent-red text-sm text-center bg-accent-red/10 border border-accent-red/30 rounded-lg py-2 px-3">
                {error}
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div className="animate-fade-in text-accent-green text-sm text-center bg-accent-green/10 border border-accent-green/30 rounded-lg py-2 px-3">
                {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-[#5a4fcf] text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-accent-purple/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                mode === "login" ? "Sign In →" : "Create Account 🚀"
              )}
            </button>
          </form>

          {/* Footer toggle */}
          <p className="text-center text-xs text-muted mt-5">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} className="text-accent-purple font-semibold hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} className="text-accent-purple font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Features */}
        <div className="flex items-center justify-center gap-6 mt-6 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green" /> AI Practice
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" /> Spaced Repetition
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" /> Smart Planner
          </span>
        </div>
      </div>
    </div>
  );
}
