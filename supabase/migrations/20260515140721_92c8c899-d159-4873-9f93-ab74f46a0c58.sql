-- ===== Extend RLS policies to include 'admin' (= super_admin) and broaden 'design' =====

-- Clients: admin + design get full access
DROP POLICY IF EXISTS "Super admin et marketing créent les clients" ON public.clients;
DROP POLICY IF EXISTS "Super admin et marketing modifient les clients" ON public.clients;
DROP POLICY IF EXISTS "Super admin et marketing suppriment les clients" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing'));

-- Commandes: admin + design + dtf
DROP POLICY IF EXISTS "Marketing/admin créent" ON public.commandes;
DROP POLICY IF EXISTS "Roles modifient commande" ON public.commandes;
DROP POLICY IF EXISTS "Super admin supprime" ON public.commandes;
CREATE POLICY "commandes_insert" ON public.commandes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "commandes_update" ON public.commandes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design') OR has_role(auth.uid(),'production') OR has_role(auth.uid(),'livraison') OR has_role(auth.uid(),'dtf'));
CREATE POLICY "commandes_delete" ON public.commandes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));

-- Commande items: design too
DROP POLICY IF EXISTS "insert_commande_items" ON public.commande_items;
DROP POLICY IF EXISTS "update_commande_items" ON public.commande_items;
DROP POLICY IF EXISTS "delete_commande_items" ON public.commande_items;
CREATE POLICY "commande_items_insert" ON public.commande_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "commande_items_update" ON public.commande_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "commande_items_delete" ON public.commande_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));

-- Documents (devis, factures, bons_livraison): add admin + design
DROP POLICY IF EXISTS "insert_admin_marketing_devis" ON public.devis;
DROP POLICY IF EXISTS "update_admin_marketing_devis" ON public.devis;
DROP POLICY IF EXISTS "delete_admin_marketing_devis" ON public.devis;
CREATE POLICY "devis_insert" ON public.devis FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "devis_update" ON public.devis FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "devis_delete" ON public.devis FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing'));

DROP POLICY IF EXISTS "insert_admin_marketing_factures" ON public.factures;
DROP POLICY IF EXISTS "update_admin_marketing_factures" ON public.factures;
DROP POLICY IF EXISTS "delete_admin_marketing_factures" ON public.factures;
CREATE POLICY "factures_insert" ON public.factures FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "factures_update" ON public.factures FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "factures_delete" ON public.factures FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing'));

DROP POLICY IF EXISTS "insert_admin_marketing_bons_livraison" ON public.bons_livraison;
DROP POLICY IF EXISTS "update_admin_marketing_bons_livraison" ON public.bons_livraison;
DROP POLICY IF EXISTS "delete_admin_marketing_bons_livraison" ON public.bons_livraison;
CREATE POLICY "bl_insert" ON public.bons_livraison FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "bl_update" ON public.bons_livraison FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing') OR has_role(auth.uid(),'design'));
CREATE POLICY "bl_delete" ON public.bons_livraison FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing'));

-- ===== Overdue notifier (3h in non_traite) =====
CREATE OR REPLACE FUNCTION public.notify_overdue_commandes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT id, number FROM public.commandes
    WHERE status = 'non_traite'
      AND created_at < now() - interval '3 hours'
      AND overdue_notified_at IS NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT ur.user_id,
      'Commande en retard',
      'La commande ' || COALESCE(c.number,'') || ' est en "Non traité" depuis plus de 3 heures.',
      '/commandes/' || c.id
    FROM public.user_roles ur;

    UPDATE public.commandes SET overdue_notified_at = now() WHERE id = c.id;
  END LOOP;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if exists then schedule every 10 minutes
DO $$ BEGIN
  PERFORM cron.unschedule('notify-overdue-commandes');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'notify-overdue-commandes',
  '*/10 * * * *',
  $$ SELECT public.notify_overdue_commandes(); $$
);