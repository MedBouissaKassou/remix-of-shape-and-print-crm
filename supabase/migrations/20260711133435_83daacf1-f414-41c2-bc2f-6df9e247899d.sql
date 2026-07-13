CREATE OR REPLACE FUNCTION public.set_commande_status(_commande_id uuid, _status text)
RETURNS public.commande_status
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_new public.commande_status;
  v_old public.commande_status;
BEGIN
  SELECT e.enumlabel::public.commande_status
  INTO v_new
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'commande_status'
    AND e.enumlabel = _status;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'invalid commande status: %', _status USING ERRCODE = '22023';
  END IF;

  SELECT status
  INTO v_old
  FROM public.commandes
  WHERE id = _commande_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commande not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old IS DISTINCT FROM v_new THEN
    UPDATE public.commandes
    SET status = v_new
    WHERE id = _commande_id;
  END IF;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';