import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard so the app doesn't crash on load if .env.local hasn't been
// filled in yet — dataClient.ts checks USE_SUPABASE before ever
// touching this client, so it's fine for it to be "unconfigured".
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === "true";
