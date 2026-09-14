import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
          <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="you@psu.edu"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="text-xs font-medium text-slate-500 mb-1 block">Password</label>
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
        </div>
      </div>
    </div>
  );
}
