import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "./AppLayout";

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  // Real Supabase Auth session check is async (getSession() on mount) —
  // without this, a page refresh would flash-redirect to /login before
  // an actually-valid persisted session finishes resolving.
  if (loading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}
