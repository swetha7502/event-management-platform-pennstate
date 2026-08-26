import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// .trim() — a dashboard-pasted env var can carry an invisible trailing
// newline that breaks header construction downstream. See openai.ts.
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — copy .env.example to .env and fill it in.'
  );
}

// Server-side client uses the service role key (bypasses RLS).
// Never expose this key or this client instance to the frontend.
export const supabase = createClient(supabaseUrl, serviceRoleKey);
