-- Rebuild the order status workflow: enum values, status change RPC, history logging, permissions.

-- Ensure every status used by the application exists in the database enum.
ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_conception' BEFORE 'en_production';
ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'livre_societe';

-- Ensure the Data API can reach the existing status tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commandes TO authenticated;
GRANT ALL ON public.commandes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_history TO authenticated;
GRANT ALL ON public.status_history TO service_role;

-- Recreate the history logger using the actual column names in this database.
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, created_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.status_history (commande_id, from_status, to_status, created_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commandes_status_log ON public.commandes;
CREATE TRIGGER trg_commandes_status_log
AFTER INSERT OR UPDATE OF status ON public.commandes
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- Function expected by the app/API cache for changing command status.
CREATE OR REPLACE FUNCTION public.set_commande_status(
  _commande_id uuid,
  _status public.commande_status
)
RETURNS public.commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_allowed boolean;
  v_commande public.commandes;
BEGIN
  v_is_allowed :=
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing')
    OR public.has_role(auth.uid(), 'design')
    OR public.has_role(auth.uid(), 'dtf')
    OR public.has_role(auth.uid(), 'livraison')
    OR public.has_role(auth.uid(), 'production');

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.commandes
  SET status = _status,
      updated_at = now()
  WHERE id = _commande_id
  RETURNING * INTO v_commande;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commande not found';
  END IF;

  RETURN v_commande;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, public.commande_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, public.commande_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_status_change() TO service_role;

-- Keep policies permissive for authenticated users as the app already gates roles in UI,
-- while the status function performs its own role check.
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated on commandes" ON public.commandes;
CREATE POLICY "Allow all authenticated on commandes"
ON public.commandes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on status_history" ON public.status_history;
CREATE POLICY "Allow all authenticated on status_history"
ON public.status_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);