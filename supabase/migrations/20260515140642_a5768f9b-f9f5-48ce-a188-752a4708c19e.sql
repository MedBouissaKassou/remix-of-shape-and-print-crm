-- Add new app roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dtf';

-- Priority enum
DO $$ BEGIN
  CREATE TYPE public.commande_priority AS ENUM ('normal', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add columns to commandes
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS priority public.commande_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS deadline timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;