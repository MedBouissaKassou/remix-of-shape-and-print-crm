
CREATE SEQUENCE IF NOT EXISTS public.commande_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_commande_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := 'CMD-' || lpad(nextval('public.commande_number_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Align sequence with existing max numeric suffix to avoid collisions
DO $$
DECLARE
  max_n bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '\D', '', 'g'), '')::bigint), 0)
    INTO max_n
  FROM public.commandes
  WHERE number ~ '^CMD-\d+$';
  IF max_n > 0 THEN
    PERFORM setval('public.commande_number_seq', max_n);
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_commande_number ON public.commandes;
CREATE TRIGGER set_commande_number
  BEFORE INSERT ON public.commandes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_commande_number();
