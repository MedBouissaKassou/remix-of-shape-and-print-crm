ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS discount_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS discount_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bons_livraison ADD COLUMN IF NOT EXISTS discount_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS discount_rate numeric NOT NULL DEFAULT 0;