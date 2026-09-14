// Calls the Express backend's /ai/chat route — the one place this app
// talks to the backend rather than Supabase directly, since the OpenAI
// key has to live server-side (see backend/src/routes/ai.ts). Never
// put an OpenAI key in frontend env vars — VITE_* vars ship in the
// public JS bundle.

import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiPrediction {
  matchedEventCount: number;
  predictedAttendance: number | null;
  attendanceRange: { low: number; high: number } | null;
  confidence: "high" | "medium" | "low";
  recommendedFoodCount: number | null;
  basisNote: string;
}

export interface AiChatResponse {
  reply: string;
  eventName: string | null;
  eventDate: string | null; // ISO yyyy-mm-dd
  needsDate: boolean;
  shouldDraftTasks: boolean;
  prediction: AiPrediction | null;
  category: string | null;
}

// .status lets callers distinguish "your session expired" (401) from
// "the server/network is actually down" (anything else) without
// pattern-matching the message text, which the raw backend error
// message won't reliably contain (e.g. "Missing Authorization header"
// never mentions "401").
export class AiChatError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function sendChatMessage(message: string, history: ChatTurn[]): Promise<AiChatResponse> {
  // Real Supabase Auth access token — the backend verifies this
  // cryptographically (supabase.auth.getUser(token)), not a raw user id.
  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const token = sessionResult?.data.session?.access_token;

  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new AiChatError(body.error || `AI chat request failed (${res.status})`, res.status);
  }
  return res.json();
}
