
-- Add updated_by column to commandes
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Trigger function: sets updated_at and updated_by on every UPDATE
CREATE OR REPLACE FUNCTION public.track_commande_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commandes_track_update ON public.commandes;
CREATE TRIGGER commandes_track_update
BEFORE UPDATE ON public.commandes
FOR EACH ROW EXECUTE FUNCTION public.track_commande_update();

-- Also propagate to commandes when a related commande_item changes
CREATE OR REPLACE FUNCTION public.touch_commande_from_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cmd uuid;
BEGIN
  v_cmd := COALESCE(NEW.commande_id, OLD.commande_id);
  IF v_cmd IS NOT NULL THEN
    UPDATE public.commandes
      SET updated_at = now(),
          updated_by = COALESCE(auth.uid(), updated_by)
      WHERE id = v_cmd;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS commande_items_touch_commande ON public.commande_items;
CREATE TRIGGER commande_items_touch_commande
AFTER INSERT OR UPDATE OR DELETE ON public.commande_items
FOR EACH ROW EXECUTE FUNCTION public.touch_commande_from_item();
