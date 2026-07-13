
-- 1. client_dtf_files: extend write access to admin, design, dtf
DROP POLICY IF EXISTS insert_admin_marketing_client_dtf_files ON public.client_dtf_files;
DROP POLICY IF EXISTS update_admin_marketing_client_dtf_files ON public.client_dtf_files;
DROP POLICY IF EXISTS delete_admin_marketing_client_dtf_files ON public.client_dtf_files;

CREATE POLICY client_dtf_files_insert ON public.client_dtf_files FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'dtf'));
CREATE POLICY client_dtf_files_update ON public.client_dtf_files FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'dtf'));
CREATE POLICY client_dtf_files_delete ON public.client_dtf_files FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'dtf'));

-- 2. incoming_funds: extend access + department column
ALTER TABLE public.incoming_funds ADD COLUMN IF NOT EXISTS department app_role;

DROP POLICY IF EXISTS incoming_funds_insert ON public.incoming_funds;
DROP POLICY IF EXISTS incoming_funds_update ON public.incoming_funds;
DROP POLICY IF EXISTS incoming_funds_delete ON public.incoming_funds;

CREATE POLICY incoming_funds_insert ON public.incoming_funds FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'dtf'));
CREATE POLICY incoming_funds_update ON public.incoming_funds FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'dtf'));
CREATE POLICY incoming_funds_delete ON public.incoming_funds FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));

-- 3. tickets: notify_roles + updated trigger
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS notify_roles app_role[];

CREATE OR REPLACE FUNCTION public.notify_ticket_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  target_roles app_role[];
BEGIN
  IF NEW.notify_roles IS NOT NULL AND array_length(NEW.notify_roles,1) > 0 THEN
    target_roles := NEW.notify_roles;
  ELSE
    target_roles := ARRAY[NEW.assigned_role];
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT DISTINCT ur.user_id,
         'Nouveau ticket',
         'Ticket: ' || NEW.name,
         '/todo'
  FROM public.user_roles ur
  WHERE ur.role = ANY(target_roles)
    AND (NEW.created_by IS NULL OR ur.user_id <> NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_assignment ON public.tickets;
CREATE TRIGGER trg_notify_ticket_assignment
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_assignment();
