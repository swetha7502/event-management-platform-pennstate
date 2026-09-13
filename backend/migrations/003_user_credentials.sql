-- Migration 003 — temp-password reference table (Coordinator-only)
-- Separate from public.users deliberately: that table is readable by
-- any logged-in user (needed for name lookups in dropdowns etc.), so a
-- password column there would let every student read everyone else's
-- password, including the coordinator's. This table is locked down to
-- Coordinators only.

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  temp_password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinators read credentials" ON public.user_credentials FOR SELECT
  USING (public.is_coordinator());
