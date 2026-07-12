DO $$
BEGIN
  ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_conception' BEFORE 'en_production';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_echantillonage' BEFORE 'en_production';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'confirme' BEFORE 'impression';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'en_dtf' BEFORE 'en_production';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.commande_status ADD VALUE IF NOT EXISTS 'livre_societe' BEFORE 'ramasse_livreur';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_commande_status(_commande_id uuid, _status text)
RETURNS public.commande_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_label text;
  v_new public.commande_status;
  v_old public.commande_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  v_key := lower(trim(coalesce(_status, '')));
  v_key := replace(v_key, '-', '_');
  v_key := regexp_replace(v_key, '\s+', '_', 'g');

  v_key := CASE v_key
    WHEN 'non_traité' THEN 'non_traite'
    WHEN 'non_traite' THEN 'non_traite'
    WHEN 'en_conception' THEN 'en_conception'
    WHEN 'en_échantillonage' THEN 'en_echantillonage'
    WHEN 'en_echantillonage' THEN 'en_echantillonage'
    WHEN 'confirmé' THEN 'confirme'
    WHEN 'confirme' THEN 'confirme'
    WHEN 'en_impression' THEN 'impression'
    WHEN 'impression' THEN 'impression'
    WHEN 'en_dtf' THEN 'en_dtf'
    WHEN 'en_production' THEN 'en_production'
    WHEN 'prêt' THEN 'prete'
    WHEN 'prete' THEN 'prete'
    WHEN 'a_livrer' THEN 'a_livrer'
    WHEN 'à_livrer' THEN 'a_livrer'
    WHEN 'a_livrer_avec_société' THEN 'livre_societe'
    WHEN 'a_livrer_avec_societe' THEN 'livre_societe'
    WHEN 'livre_societe' THEN 'livre_societe'
    WHEN 'ramassé_par_livreur' THEN 'ramasse_livreur'
    WHEN 'rammasé_par_livreur' THEN 'ramasse_livreur'
    WHEN 'ramasse_par_livreur' THEN 'ramasse_livreur'
    WHEN 'ramasse_livreur' THEN 'ramasse_livreur'
    WHEN 'livré' THEN 'livre'
    WHEN 'livre' THEN 'livre'
    ELSE v_key
  END;

  SELECT e.enumlabel
  INTO v_label
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'commande_status'
    AND e.enumlabel = v_key;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Statut de commande invalide: %', _status USING ERRCODE = '22023';
  END IF;

  v_new := v_label::public.commande_status;

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

REVOKE ALL ON FUNCTION public.set_commande_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';