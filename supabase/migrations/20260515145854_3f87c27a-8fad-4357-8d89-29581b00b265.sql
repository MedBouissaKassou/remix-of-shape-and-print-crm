ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'livre_societe';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone2 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS governorate text;