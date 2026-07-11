-- Clients table
CREATE TYPE public.client_type AS ENUM ('particulier', 'entreprise');

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  client_type public.client_type NOT NULL DEFAULT 'particulier',
  company_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_full_name ON public.clients (full_name);
CREATE INDEX idx_clients_phone ON public.clients (phone);
CREATE INDEX idx_clients_created_at ON public.clients (created_at DESC);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients visibles par utilisateurs connectés"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin et marketing créent les clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'marketing'));

CREATE POLICY "Super admin et marketing modifient les clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'marketing'));

CREATE POLICY "Super admin et marketing suppriment les clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'marketing'));

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Client files table
CREATE TABLE public.client_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_files_client_id ON public.client_files (client_id);

ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fichiers clients visibles par connectés"
  ON public.client_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "Marketing/Design/Admin ajoutent fichiers"
  ON public.client_files FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'marketing')
    OR public.has_role(auth.uid(), 'design')
  );

CREATE POLICY "Marketing/Design/Admin suppriment fichiers"
  ON public.client_files FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'marketing')
    OR public.has_role(auth.uid(), 'design')
  );

-- Realtime
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('client-files', 'client-files', false);

CREATE POLICY "Fichiers clients lecture connectés"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files');

CREATE POLICY "Fichiers clients upload équipe"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-files' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'marketing')
      OR public.has_role(auth.uid(), 'design')
    )
  );

CREATE POLICY "Fichiers clients delete équipe"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files' AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'marketing')
      OR public.has_role(auth.uid(), 'design')
    )
  );