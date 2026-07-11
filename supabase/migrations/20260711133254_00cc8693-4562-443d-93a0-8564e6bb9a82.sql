CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commandes_status_log ON public.commandes;
CREATE TRIGGER trg_commandes_status_log
AFTER INSERT OR UPDATE OF status ON public.commandes
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

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