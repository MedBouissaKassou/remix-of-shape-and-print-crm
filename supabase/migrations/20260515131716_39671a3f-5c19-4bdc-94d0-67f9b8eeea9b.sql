ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS comment text;