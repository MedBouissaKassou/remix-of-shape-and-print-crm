-- Ticket status enum
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status public.ticket_status NOT NULL DEFAULT 'todo',
  created_by uuid,
  created_by_role public.app_role,
  assigned_role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_all" ON public.tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tickets_insert_auth" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Admin/SuperAdmin: full update
CREATE POLICY "tickets_update_admin" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- Assigned department: can update (used to change status)
CREATE POLICY "tickets_update_assigned" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), assigned_role));

CREATE POLICY "tickets_delete_admin" ON public.tickets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify assigned department on ticket creation
CREATE OR REPLACE FUNCTION public.notify_ticket_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT ur.user_id,
         'Nouveau ticket assigné',
         'Ticket: ' || NEW.name,
         '/todo'
  FROM public.user_roles ur
  WHERE ur.role = NEW.assigned_role;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_notify_assignment
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_assignment();
