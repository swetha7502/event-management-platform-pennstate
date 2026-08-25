-- Migration 002 — Aug 2026 pre-launch security pass
-- Run this once in Supabase's SQL Editor. Safe to re-run (IF NOT EXISTS
-- guards on the additive parts); the RLS section will error on a second
-- run since policies aren't currently guarded with IF NOT EXISTS — if
-- you need to re-run just that section, drop the policies first.

-- ============================================================
-- 1. attachment_url column (task attach-link feature)
-- ============================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url text;

-- ============================================================
-- 2. Shared draft-plan tables (AI chat -> Review page, now persisted
--    so both Coordinators see the same draft, not one browser's memory)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draft_plans (
  draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_title text NOT NULL,
  event_date date NOT NULL,
  cultural_tag text,
  predicted_attendance integer,
  attendance_range_low integer,
  attendance_range_high integer,
  prediction_confidence text,
  recommended_food_count integer,
  basis_note text,
  event_id uuid REFERENCES public.events(event_id),
  created_by uuid REFERENCES public.users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.draft_tasks (
  draft_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.draft_plans(draft_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  phase text NOT NULL,
  due_date date,
  assigned_to uuid REFERENCES public.users(user_id),
  assignee_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Row-Level Security — real policies now that real Supabase Auth
--    sessions exist. Before this, every table was wide open to the
--    public anon key (verified live: anyone could read all users'
--    emails/roles with just the key baked into the frontend bundle).
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_coordinator() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users pu
    JOIN auth.users au ON au.email = pu.email
    WHERE au.id = auth.uid() AND pu.role = 'Coordinator'
  );
$$;

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_tasks       ENABLE ROW LEVEL SECURITY;

-- users: everyone logged in can read the roster; no direct writes from
-- the app (accounts are provisioned via the service-role admin script)
CREATE POLICY "read users" ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- events: everyone reads; only Coordinators write
CREATE POLICY "read events" ON public.events FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators write events" ON public.events FOR INSERT
  WITH CHECK (public.is_coordinator());
CREATE POLICY "coordinators update events" ON public.events FOR UPDATE
  USING (public.is_coordinator());
CREATE POLICY "coordinators delete events" ON public.events FOR DELETE
  USING (public.is_coordinator());

-- tasks: everyone reads/creates/updates (matches existing app behavior
-- — either role can add/edit a task); only Coordinators delete
CREATE POLICY "read tasks" ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated insert tasks" ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update tasks" ON public.tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators delete tasks" ON public.tasks FOR DELETE
  USING (public.is_coordinator());

-- inventory: everyone reads/updates counts; only Coordinators add/remove items
CREATE POLICY "read inventory" ON public.inventory_items FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update inventory" ON public.inventory_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators insert inventory" ON public.inventory_items FOR INSERT
  WITH CHECK (public.is_coordinator());
CREATE POLICY "coordinators delete inventory" ON public.inventory_items FOR DELETE
  USING (public.is_coordinator());

-- attendance/food logs: everyone reads (stats page); only Coordinators
-- write (event-completion flow)
CREATE POLICY "read attendance_logs" ON public.attendance_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators insert attendance_logs" ON public.attendance_logs FOR INSERT
  WITH CHECK (public.is_coordinator());

CREATE POLICY "read food_logs" ON public.food_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators insert food_logs" ON public.food_logs FOR INSERT
  WITH CHECK (public.is_coordinator());

-- unused tables today — Coordinator-only for now, revisit when built
CREATE POLICY "coordinators all rsvps" ON public.rsvps FOR ALL
  USING (public.is_coordinator()) WITH CHECK (public.is_coordinator());
CREATE POLICY "coordinators all materials_logs" ON public.materials_logs FOR ALL
  USING (public.is_coordinator()) WITH CHECK (public.is_coordinator());
CREATE POLICY "coordinators all reports" ON public.reports FOR ALL
  USING (public.is_coordinator()) WITH CHECK (public.is_coordinator());

-- draft_plans/draft_tasks: everyone can read + create (both roles can
-- chat with the AI and trigger a draft); only Coordinators edit/resolve
-- (Review page is Coordinator-only)
CREATE POLICY "read draft_plans" ON public.draft_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated insert draft_plans" ON public.draft_plans FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators update draft_plans" ON public.draft_plans FOR UPDATE
  USING (public.is_coordinator());
CREATE POLICY "coordinators delete draft_plans" ON public.draft_plans FOR DELETE
  USING (public.is_coordinator());

CREATE POLICY "read draft_tasks" ON public.draft_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated insert draft_tasks" ON public.draft_tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "coordinators update draft_tasks" ON public.draft_tasks FOR UPDATE
  USING (public.is_coordinator());
CREATE POLICY "coordinators delete draft_tasks" ON public.draft_tasks FOR DELETE
  USING (public.is_coordinator());
