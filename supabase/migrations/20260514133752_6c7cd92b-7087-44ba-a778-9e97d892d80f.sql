
CREATE TABLE public.commande_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  order_type_id uuid REFERENCES public.order_types(id) ON DELETE SET NULL,
  designation text,
  dimension text,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric,
  total_ht numeric,
  tva_rate numeric DEFAULT 19,
  tva_amount numeric DEFAULT 0,
  total_ttc numeric,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commande_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_commande_items" ON public.commande_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_commande_items" ON public.commande_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role));

CREATE POLICY "update_commande_items" ON public.commande_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role));

CREATE POLICY "delete_commande_items" ON public.commande_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role));

CREATE INDEX idx_commande_items_commande ON public.commande_items(commande_id);

-- Backfill: 1 item par commande existante
INSERT INTO public.commande_items (
  commande_id, position, order_type_id, designation, dimension,
  quantity, unit_price, total_ht, tva_rate, tva_amount, total_ttc, color
)
SELECT
  c.id, 0, c.order_type_id,
  COALESCE(NULLIF(c.description, ''), 'Commande'),
  CASE
    WHEN c.height_cm IS NOT NULL AND c.width_cm IS NOT NULL
      THEN c.height_cm::text || ' x ' || c.width_cm::text || ' cm'
    WHEN c.size_label IS NOT NULL AND c.size_label <> ''
      THEN c.size_label
    ELSE NULL
  END,
  COALESCE(c.quantity, 1),
  c.unit_price,
  c.total_price,
  COALESCE(c.tva_rate, 19),
  COALESCE(c.tva_amount, 0),
  COALESCE(c.total_price, 0) + COALESCE(c.tva_amount, 0),
  c.color
FROM public.commandes c
WHERE NOT EXISTS (SELECT 1 FROM public.commande_items i WHERE i.commande_id = c.id);

-- Onglet Autres pour le fichier Excel client
ALTER TABLE public.client_dtf_files
  ADD COLUMN IF NOT EXISTS other_rows jsonb NOT NULL DEFAULT '[]'::jsonb;
