import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session as AppSession } from "../types";
import { supabase, USE_SUPABASE } from "../lib/supabaseClient";
import { getUserProfile } from "../lib/dataClient";

interface AuthContextValue {
  session: AppSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Real Supabase Auth (email/password, sessions, password reset) —
// replaces the old name+role placeholder. `session` keeps the same
// shape as before ({role, name, userId}) so every other component
// that consumes useAuth() is unaffected by this swap.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveSession = async (email: string | null | undefined) => {
    if (!email) {
      setSession(null);
      return;
    }
    const profile = await getUserProfile(email);
    setSession(profile ? { role: profile.role, name: profile.name, userId: profile.user_id } : null);
  };

  useEffect(() => {
    if (!(USE_SUPABASE && supabase)) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      resolveSession(data.session?.user.email).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      resolveSession(authSession?.user.email);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!(USE_SUPABASE && supabase)) {
      await resolveSession(email);
      return session ? {} : { error: "No matching profile in mock roster." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Incorrect email or password." };

    // Resolve the profile *here*, synchronously with login, instead of
    // relying on the onAuthStateChange listener to eventually catch up —
    // otherwise a valid login with no matching public.users row silently
    // bounces back to /login with no explanation (a real account, just
    // missing from the roster, e.g. a typo when it was added).
    const profile = await getUserProfile(email);
    if (!profile) {
      await supabase.auth.signOut();
      return { error: "Your account isn't on the event platform roster yet. Contact a Coordinator." };
    }
    setSession({ role: profile.role, name: profile.name, userId: profile.user_id });
    return {};
  };

  const logout = async () => {
    if (USE_SUPABASE && supabase) await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
