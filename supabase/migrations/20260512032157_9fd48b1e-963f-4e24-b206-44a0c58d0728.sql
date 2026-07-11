
-- Enums
CREATE TYPE public.commande_status AS ENUM (
  'non_traite','en_production','impression','prete','a_livrer','ramasse_livreur','livre'
);

-- Order types
CREATE TABLE public.order_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Types visibles" ON public.order_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin gère types insert" ON public.order_types FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin gère types update" ON public.order_types FOR UPDATE TO authenticated USING (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin gère types delete" ON public.order_types FOR DELETE TO authenticated USING (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_order_types_updated BEFORE UPDATE ON public.order_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.order_types (name, description) VALUES
  ('DTF', 'Impression DTF'),
  ('Flyers', 'Impression flyers'),
  ('Banderoles', 'Banderoles & bâches'),
  ('Cartes de visite', 'Cartes de visite'),
  ('Stickers', 'Stickers et autocollants');

-- Sequence for commande number
CREATE SEQUENCE public.commande_number_seq START 1000;

-- Commandes
CREATE TABLE public.commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('CMD-' || nextval('public.commande_number_seq')),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  order_type_id uuid REFERENCES public.order_types(id) ON DELETE SET NULL,
  description text,
  quantity int NOT NULL DEFAULT 1,
  height_cm numeric,
  width_cm numeric,
  color text,
  size_label text,
  unit_price numeric,
  total_price numeric,
  comment text,
  status public.commande_status NOT NULL DEFAULT 'non_traite',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commandes visibles" ON public.commandes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Marketing/admin créent" ON public.commandes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing'));
CREATE POLICY "Roles modifient commande" ON public.commandes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing')
    OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production')
    OR has_role(auth.uid(),'livraison')
  );
CREATE POLICY "Super admin supprime" ON public.commandes FOR DELETE TO authenticated USING (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_commandes_updated BEFORE UPDATE ON public.commandes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_commandes_status ON public.commandes(status);
CREATE INDEX idx_commandes_client ON public.commandes(client_id);

-- Commande files
CREATE TABLE public.commande_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commande_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fichiers cmd visibles" ON public.commande_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Roles ajoutent fichiers cmd" ON public.commande_files FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production'));
CREATE POLICY "Roles suppriment fichiers cmd" ON public.commande_files FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production'));

-- Status history
CREATE TABLE public.status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  from_status public.commande_status,
  to_status public.commande_status NOT NULL,
  changed_by uuid,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Historique visible" ON public.status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tous insèrent historique" ON public.status_history FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_commandes_status_log AFTER INSERT OR UPDATE OF status ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- Reminders
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  message text,
  target_role app_role,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rappels visibles" ON public.reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tous créent rappels" ON public.reminders FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voir mes notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Tous créent notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Marquer mes notifs lues" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- Trigger that fans out a reminder into notifications for users with the target role
CREATE OR REPLACE FUNCTION public.fanout_reminder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cmd_number text;
BEGIN
  SELECT number INTO cmd_number FROM public.commandes WHERE id = NEW.commande_id;
  IF NEW.target_role IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT ur.user_id,
           'Rappel commande ' || COALESCE(cmd_number,''),
           COALESCE(NEW.message, 'Nouveau rappel'),
           '/commandes/' || NEW.commande_id
    FROM public.user_roles ur
    WHERE ur.role = NEW.target_role;
  ELSE
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT ur.user_id,
           'Rappel commande ' || COALESCE(cmd_number,''),
           COALESCE(NEW.message, 'Nouveau rappel'),
           '/commandes/' || NEW.commande_id
    FROM public.user_roles ur;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reminders_fanout AFTER INSERT ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.fanout_reminder();

-- Realtime
ALTER TABLE public.commandes REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commandes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('commande-files','commande-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Voir fichiers commande" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'commande-files');
CREATE POLICY "Upload fichiers commande" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'commande-files' AND (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing')
    OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production')
  ));
CREATE POLICY "Supprimer fichiers commande" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'commande-files' AND (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'marketing')
    OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production')
  ));
