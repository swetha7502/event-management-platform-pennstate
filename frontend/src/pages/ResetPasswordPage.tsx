import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { supabase, USE_SUPABASE } from "../lib/supabaseClient";

// Landing page for the link in a Supabase password-reset email. Supabase's
// client detects the recovery token in the URL automatically and fires a
// PASSWORD_RECOVERY auth event — that's the signal this page waits for
// before showing the "set a new password" form.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!(USE_SUPABASE && supabase)) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!(USE_SUPABASE && supabase)) return;
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-blue-900 px-8 py-7 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Sparkles size={22} className="text-blue-200" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Set a new password</h1>
        </div>

        <div className="p-8 pt-6">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Password updated — signing you in…</p>
            </div>
          ) : !ready ? (
            <p className="text-sm text-slate-500">
              Waiting for a valid reset link… if you opened this page directly, use "Forgot
              password" on the login page instead.
            </p>
          ) : (
            <>
              <label className="text-xs font-medium text-slate-500 mb-1 block">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <label className="text-xs font-medium text-slate-500 mb-1 block">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
              >
                {busy ? "Saving…" : "Set password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
