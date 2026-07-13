
-- Add missing tables and columns

-- 1. incoming_funds
CREATE TABLE public.incoming_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  label TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  department app_role,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incoming_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated on incoming_funds" ON public.incoming_funds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role app_role,
  assigned_role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attachment_path TEXT,
  attachment_name TEXT,
  notify_roles app_role[] DEFAULT '{}'::app_role[]
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated on tickets" ON public.tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Missing columns
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT (id) DO NOTHING;
