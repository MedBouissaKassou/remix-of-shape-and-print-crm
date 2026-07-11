
-- Sequences for document numbering
CREATE SEQUENCE IF NOT EXISTS devis_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS bl_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS facture_number_seq START 1;

-- Devis
CREATE TABLE public.devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('DEV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('devis_number_seq')::text, 5, '0')),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  total_ht numeric,
  total_ttc numeric,
  tva_rate numeric DEFAULT 19,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bons_livraison (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('BL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('bl_number_seq')::text, 5, '0')),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('FAC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('facture_number_seq')::text, 5, '0')),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  total_ht numeric,
  total_ttc numeric,
  tva_rate numeric DEFAULT 19,
  paid boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_dtf_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  advances jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dtf_updated_at BEFORE UPDATE ON public.client_dtf_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_dtf_files ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern for the three doc tables)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['devis','bons_livraison','factures','client_dtf_files'] LOOP
    EXECUTE format('CREATE POLICY "select_all_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "insert_admin_marketing_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),''super_admin''::app_role) OR has_role(auth.uid(),''marketing''::app_role))', t);
    EXECUTE format('CREATE POLICY "update_admin_marketing_%1$s" ON public.%1$I FOR UPDATE TO authenticated USING (has_role(auth.uid(),''super_admin''::app_role) OR has_role(auth.uid(),''marketing''::app_role))', t);
    EXECUTE format('CREATE POLICY "delete_admin_marketing_%1$s" ON public.%1$I FOR DELETE TO authenticated USING (has_role(auth.uid(),''super_admin''::app_role) OR has_role(auth.uid(),''marketing''::app_role))', t);
  END LOOP;
END $$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documents','documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('dtf-excel','dtf-excel', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "documents_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "documents_insert_roles" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));
CREATE POLICY "documents_update_roles" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));
CREATE POLICY "documents_delete_roles" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));

CREATE POLICY "dtf_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'dtf-excel');
CREATE POLICY "dtf_insert_roles" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dtf-excel' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));
CREATE POLICY "dtf_update_roles" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'dtf-excel' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));
CREATE POLICY "dtf_delete_roles" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'dtf-excel' AND (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role)));
