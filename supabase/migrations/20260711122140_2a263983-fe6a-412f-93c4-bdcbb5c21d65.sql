ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_echantillonage';
ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'confirme';
ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_dtf';