CREATE TABLE public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_connections_user_id_connected_at_idx ON public.user_connections (user_id, connected_at DESC);
CREATE INDEX user_connections_connected_at_idx ON public.user_connections (connected_at DESC);

GRANT SELECT, INSERT ON public.user_connections TO authenticated;
GRANT ALL ON public.user_connections TO service_role;

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own connections"
  ON public.user_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own connections"
  ON public.user_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all connections"
  ON public.user_connections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));