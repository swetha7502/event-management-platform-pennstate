import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — copy .env.example to .env and fill it in.'
  );
}

// Server-side client uses the service role key (bypasses RLS).
// Never expose this key or this client instance to the frontend.
export const supabase = createClient(supabaseUrl, serviceRoleKey);
