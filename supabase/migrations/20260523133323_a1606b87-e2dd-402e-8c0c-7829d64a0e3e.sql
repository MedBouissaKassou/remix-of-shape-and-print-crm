
-- ============================================================
-- ShapeAndPrint CRM — Full Database Schema Migration
-- ============================================================

-- --------------------------------------------------
-- 1. ENUMS
-- --------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'marketing', 'design', 'production', 'livraison', 'dtf');
CREATE TYPE public.commande_status AS ENUM ('non_traite', 'en_production', 'impression', 'prete', 'a_livrer', 'ramasse_livreur', 'livre_societe', 'livre');
CREATE TYPE public.client_type AS ENUM ('particulier', 'entreprise');
CREATE TYPE public.contact_origin AS ENUM ('facebook', 'instagram', 'whatsapp', 'site_web', 'telephone', 'sur_lieu', 'autre');

-- --------------------------------------------------
-- 2. TABLES
-- --------------------------------------------------

-- profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  phone2 TEXT,
  email TEXT,
  address TEXT,
  governorate TEXT,
  city TEXT,
  postal_code TEXT,
  client_type client_type NOT NULL DEFAULT 'particulier',
  company_name TEXT,
  tax_id TEXT,
  brand_name TEXT,
  contact_origin contact_origin,
  contact_origin_other TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- client_files
CREATE TABLE public.client_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- client_dtf_files
CREATE TABLE public.client_dtf_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path TEXT,
  rows JSONB DEFAULT '[]'::jsonb,
  other_rows JSONB DEFAULT '[]'::jsonb,
  advances JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- order_types
CREATE TABLE public.order_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- commandes
CREATE TABLE public.commandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status commande_status NOT NULL DEFAULT 'non_traite',
  description TEXT,
  quantity INTEGER DEFAULT 1,
  height_cm NUMERIC,
  width_cm NUMERIC,
  color TEXT,
  size_label TEXT,
  unit_price NUMERIC,
  total_price NUMERIC,
  tva_rate NUMERIC DEFAULT 19,
  tva_amount NUMERIC,
  comment TEXT,
  priority TEXT DEFAULT 'normal',
  deadline TIMESTAMPTZ,
  avance NUMERIC DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  discount_rate NUMERIC DEFAULT 0,
  order_type_id UUID REFERENCES public.order_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- commande_items
CREATE TABLE public.commande_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  designation TEXT,
  dimension TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC,
  total_ht NUMERIC,
  tva_rate NUMERIC DEFAULT 19,
  tva_amount NUMERIC,
  total_ttc NUMERIC,
  color TEXT,
  order_type_id UUID REFERENCES public.order_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- commande_files
CREATE TABLE public.commande_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  commande_item_id UUID REFERENCES public.commande_items(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- status_history
CREATE TABLE public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  from_status commande_status,
  to_status commande_status NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reminders
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  message TEXT,
  target_role app_role,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- devis
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  commande_id UUID REFERENCES public.commandes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  storage_path TEXT,
  total_ht NUMERIC,
  total_ttc NUMERIC,
  tva_rate NUMERIC DEFAULT 19,
  discount_rate NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  comment TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- bons_livraison
CREATE TABLE public.bons_livraison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  commande_id UUID REFERENCES public.commandes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  storage_path TEXT,
  total_ttc NUMERIC,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- factures
CREATE TABLE public.factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  commande_id UUID REFERENCES public.commandes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  storage_path TEXT,
  total_ht NUMERIC,
  total_ttc NUMERIC,
  tva_rate NUMERIC DEFAULT 19,
  discount_rate NUMERIC DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------
-- 3. NUMBER GENERATION TRIGGERS
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_commande_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := 'CMD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commande_number_trigger
BEFORE INSERT ON public.commandes
FOR EACH ROW EXECUTE FUNCTION public.generate_commande_number();

CREATE OR REPLACE FUNCTION public.generate_devis_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := 'DV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devis_number_trigger
BEFORE INSERT ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.generate_devis_number();

CREATE OR REPLACE FUNCTION public.generate_bl_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := 'BL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bl_number_trigger
BEFORE INSERT ON public.bons_livraison
FOR EACH ROW EXECUTE FUNCTION public.generate_bl_number();

CREATE OR REPLACE FUNCTION public.generate_facture_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := 'FAC-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facture_number_trigger
BEFORE INSERT ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.generate_facture_number();

-- --------------------------------------------------
-- 4. SECURITY FUNCTIONS
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.update_user_credentials(
  target_user_id UUID,
  new_username TEXT,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF new_username IS NOT NULL AND new_username != '' THEN
    v_email := lower(new_username) || '@shapeandprint.local';
    UPDATE auth.users
    SET email = v_email, email_confirmed_at = now()
    WHERE id = target_user_id;
  END IF;
  IF new_password IS NOT NULL AND new_password != '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- --------------------------------------------------
-- 5. AUTO-CREATE PROFILE ON SIGNUP
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------
-- 6. RLS ENABLE
-- --------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_dtf_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commande_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commande_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------
-- 7. RLS POLICIES — PERMISSIVE FOR AUTHENTICATED
-- --------------------------------------------------

-- profiles
CREATE POLICY "Allow all authenticated on profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_roles
CREATE POLICY "Allow all authenticated on user_roles" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clients
CREATE POLICY "Allow all authenticated on clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_files
CREATE POLICY "Allow all authenticated on client_files" ON public.client_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_dtf_files
CREATE POLICY "Allow all authenticated on client_dtf_files" ON public.client_dtf_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- order_types
CREATE POLICY "Allow all authenticated on order_types" ON public.order_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- commandes
CREATE POLICY "Allow all authenticated on commandes" ON public.commandes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- commande_items
CREATE POLICY "Allow all authenticated on commande_items" ON public.commande_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- commande_files
CREATE POLICY "Allow all authenticated on commande_files" ON public.commande_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- status_history
CREATE POLICY "Allow all authenticated on status_history" ON public.status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- reminders
CREATE POLICY "Allow all authenticated on reminders" ON public.reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- devis
CREATE POLICY "Allow all authenticated on devis" ON public.devis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bons_livraison
CREATE POLICY "Allow all authenticated on bons_livraison" ON public.bons_livraison FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- factures
CREATE POLICY "Allow all authenticated on factures" ON public.factures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notifications
CREATE POLICY "Allow all authenticated on notifications" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------
-- 8. STORAGE BUCKETS
-- --------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('client-files', 'client-files', false),
  ('commande-files', 'commande-files', false),
  ('dtf-excel', 'dtf-excel', false)
ON CONFLICT (id) DO NOTHING;
