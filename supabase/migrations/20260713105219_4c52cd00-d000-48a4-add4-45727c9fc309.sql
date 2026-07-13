DO $$
BEGIN
  CREATE TYPE public.commande_status_v2 AS ENUM (
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
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DROP TRIGGER IF EXISTS trg_commandes_status_log ON public.commandes;

ALTER TABLE public.commandes
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.commandes
  ALTER COLUMN status TYPE public.commande_status_v2
  USING status::text::public.commande_status_v2;

ALTER TABLE public.commandes
  ALTER COLUMN status SET DEFAULT 'non_traite'::public.commande_status_v2;

ALTER TABLE public.status_history
  ALTER COLUMN from_status TYPE public.commande_status_v2
  USING CASE WHEN from_status IS NULL THEN NULL ELSE from_status::text::public.commande_status_v2 END,
  ALTER COLUMN to_status TYPE public.commande_status_v2
  USING to_status::text::public.commande_status_v2;

DROP FUNCTION IF EXISTS public.set_commande_status(uuid, text);
DROP TYPE IF EXISTS public.commande_status;
ALTER TYPE public.commande_status_v2 RENAME TO commande_status;

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE TRIGGER trg_commandes_status_log
AFTER INSERT OR UPDATE OF status ON public.commandes
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();

NOTIFY pgrst, 'reload schema';