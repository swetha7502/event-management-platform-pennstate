import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase, USE_SUPABASE } from "../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error: loginError } = await login(email.trim(), password);
    setBusy(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    navigate("/dashboard");
  };

  const handleForgot = async () => {
    setError("");
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    if (!(USE_SUPABASE && supabase)) {
      setError("Password reset isn't available in this mode.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-blue-900 px-8 py-7 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Sparkles size={22} className="text-blue-200" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">
            Global Engagement Office
          </h1>
          <p className="text-blue-200 text-xs mt-1">Event Management Platform</p>
        </div>

        <div className="p-8 pt-6">
          {mode === "login" ? (
            <>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="you@psu.edu"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-500 block">Password</label>
                <button
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setResetSent(false);
                  }}
                  className="text-xs text-blue-700 hover:text-blue-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

              <button
                onClick={handleLogin}
                disabled={busy}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
              >
                {busy ? "Logging in…" : "Log in"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4"
              >
                <ArrowLeft size={12} /> Back to login
              </button>

              {resetSent ? (
                <p className="text-sm text-slate-600 mb-2">
                  If an account exists for <span className="font-medium">{email.trim()}</span>, a
                  password reset link has been sent — check your inbox.
                </p>
              ) : (
                <>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                    placeholder="you@psu.edu"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
                  <button
                    onClick={handleForgot}
                    disabled={busy}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
