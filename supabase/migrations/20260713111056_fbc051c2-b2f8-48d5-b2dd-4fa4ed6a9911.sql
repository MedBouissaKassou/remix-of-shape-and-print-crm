-- Fresh rebuild of the commande status workflow.
-- This preserves existing rows while replacing the enum with the requested ordered list.

DROP TRIGGER IF EXISTS trg_commandes_status_log ON public.commandes;
DROP FUNCTION IF EXISTS public.set_commande_status(uuid, public.commande_status);
DROP FUNCTION IF EXISTS public.set_commande_status(uuid, text);
DROP FUNCTION IF EXISTS public.log_status_change();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'commande_status_new'
  ) THEN
    DROP TYPE public.commande_status_new;
  END IF;
END $$;

CREATE TYPE public.commande_status_new AS ENUM (
  'non_traite',
  'en_conception',
  'en_echantillonage',
  'confirme',
  'impression',
  'en_dtf',
  'en_production',
  'prete',
  'a_livrer',
  'livre_societe',
  'ramasse_livreur',
  'livre'
);

ALTER TABLE public.commandes ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.commandes
  ALTER COLUMN status TYPE public.commande_status_new
  USING status::text::public.commande_status_new;

ALTER TABLE public.status_history
  ALTER COLUMN from_status TYPE public.commande_status_new
  USING CASE WHEN from_status IS NULL THEN NULL ELSE from_status::text::public.commande_status_new END;

ALTER TABLE public.status_history
  ALTER COLUMN to_status TYPE public.commande_status_new
  USING to_status::text::public.commande_status_new;

DROP TYPE public.commande_status;
ALTER TYPE public.commande_status_new RENAME TO commande_status;

ALTER TABLE public.commandes
  ALTER COLUMN status SET DEFAULT 'non_traite'::public.commande_status;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commandes TO authenticated;
GRANT ALL ON public.commandes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_history TO authenticated;
GRANT ALL ON public.status_history TO service_role;

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

CREATE TRIGGER trg_commandes_status_log
AFTER INSERT OR UPDATE OF status ON public.commandes
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- Text argument intentionally avoids enum-argument RPC cache mismatches.
CREATE OR REPLACE FUNCTION public.set_commande_status(
  _commande_id uuid,
  _status text
)
RETURNS public.commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_allowed boolean;
  v_status public.commande_status;
  v_commande public.commandes;
BEGIN
  IF _status IS NULL OR btrim(_status) = '' THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  BEGIN
    v_status := btrim(_status)::public.commande_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END;

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
  SET status = v_status,
      updated_at = now()
  WHERE id = _commande_id
  RETURNING * INTO v_commande;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commande not found';
  END IF;

  RETURN v_commande;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_status_change() TO service_role;

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

NOTIFY pgrst, 'reload schema';