ALTER TABLE public.commande_items
ADD COLUMN IF NOT EXISTS total_metrage numeric;

DROP TRIGGER IF EXISTS set_commande_number ON public.commandes;
CREATE TRIGGER set_commande_number
BEFORE INSERT ON public.commandes
FOR EACH ROW
EXECUTE FUNCTION public.generate_commande_number();