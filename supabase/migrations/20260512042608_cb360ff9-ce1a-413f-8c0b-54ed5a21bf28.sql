ALTER TABLE public.commandes
ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 19,
ADD COLUMN IF NOT EXISTS tva_amount numeric DEFAULT 0;

ALTER TABLE public.bons_livraison
ADD COLUMN IF NOT EXISTS total_ttc numeric;