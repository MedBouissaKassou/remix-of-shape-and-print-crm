
-- 1. Clients: contact origin
CREATE TYPE public.contact_origin AS ENUM ('facebook','instagram','whatsapp','site_web','telephone','sur_lieu','autre');
ALTER TABLE public.clients
  ADD COLUMN contact_origin public.contact_origin NULL,
  ADD COLUMN contact_origin_other text NULL;

-- 2. Commandes: avance + paid
ALTER TABLE public.commandes
  ADD COLUMN avance numeric NOT NULL DEFAULT 0,
  ADD COLUMN paid boolean NOT NULL DEFAULT false;

-- 3. Commande items: total_metrage
ALTER TABLE public.commande_items
  ADD COLUMN total_metrage numeric NULL;

-- 4. Commande files: link to item
ALTER TABLE public.commande_files
  ADD COLUMN commande_item_id uuid NULL;

-- 5. Tickets: attachment + creator can edit
ALTER TABLE public.tickets
  ADD COLUMN attachment_path text NULL,
  ADD COLUMN attachment_name text NULL;

CREATE POLICY tickets_update_creator ON public.tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY tickets_delete_creator ON public.tickets
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 6. Incoming funds (revenus libres)
CREATE TABLE public.incoming_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  label text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incoming_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY incoming_funds_select ON public.incoming_funds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY incoming_funds_insert ON public.incoming_funds
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing'));
CREATE POLICY incoming_funds_update ON public.incoming_funds
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));
CREATE POLICY incoming_funds_delete ON public.incoming_funds
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));

-- 7. DTF role can create clients / commandes / commande_items
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design')
    OR has_role(auth.uid(),'dtf')
  );

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design')
    OR has_role(auth.uid(),'dtf')
  );

DROP POLICY IF EXISTS commandes_insert ON public.commandes;
CREATE POLICY commandes_insert ON public.commandes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design')
    OR has_role(auth.uid(),'dtf')
  );

DROP POLICY IF EXISTS commande_items_insert ON public.commande_items;
CREATE POLICY commande_items_insert ON public.commande_items
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design')
    OR has_role(auth.uid(),'dtf')
  );

DROP POLICY IF EXISTS commande_items_update ON public.commande_items;
CREATE POLICY commande_items_update ON public.commande_items
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design')
    OR has_role(auth.uid(),'dtf')
  );
