CREATE UNIQUE INDEX IF NOT EXISTS user_connections_user_session_uidx
  ON public.user_connections (user_id, connected_at);

CREATE OR REPLACE FUNCTION public.record_observed_presence(_user_id uuid, _online_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR auth.uid() = _user_id
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.user_connections (user_id, connected_at, last_seen_at)
  VALUES (_user_id, _online_at, now())
  ON CONFLICT (user_id, connected_at)
  DO UPDATE SET last_seen_at = GREATEST(public.user_connections.last_seen_at, now());
END;
$$;

REVOKE ALL ON FUNCTION public.record_observed_presence(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_observed_presence(uuid, timestamptz) TO authenticated;