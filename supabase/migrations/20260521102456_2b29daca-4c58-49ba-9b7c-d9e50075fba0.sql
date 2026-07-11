-- Tighten SELECT: creator, assigned role, or admin/super_admin
DROP POLICY IF EXISTS "tickets_select_all" ON public.tickets;

CREATE POLICY "tickets_select_scoped"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = created_by
  OR has_role(auth.uid(), assigned_role)
);

-- Remove update-by-assigned: only creator or admin/super_admin can update
DROP POLICY IF EXISTS "tickets_update_assigned" ON public.tickets;
