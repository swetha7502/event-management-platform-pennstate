-- Inventory updates (name/category/count edits) were left open to any
-- authenticated user, matching only reads being universal. In practice
-- that meant a Student could edit or zero out any inventory item
-- directly via the Supabase API, bypassing the UI's intent entirely.
-- Only Coordinators should be able to modify inventory, same as
-- insert/delete.

DROP POLICY IF EXISTS "authenticated update inventory" ON public.inventory_items;

CREATE POLICY "coordinators update inventory" ON public.inventory_items FOR UPDATE
  USING (public.is_coordinator());
