
-- Cascade deletes from clients/commandes to related rows
ALTER TABLE public.commandes DROP CONSTRAINT IF EXISTS commandes_client_id_fkey;
ALTER TABLE public.commandes
  ADD CONSTRAINT commandes_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_files DROP CONSTRAINT IF EXISTS client_files_client_id_fkey;
ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.client_dtf_files DROP CONSTRAINT IF EXISTS client_dtf_files_client_id_fkey;
ALTER TABLE public.client_dtf_files
  ADD CONSTRAINT client_dtf_files_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.commande_items DROP CONSTRAINT IF EXISTS commande_items_commande_id_fkey;
ALTER TABLE public.commande_items
  ADD CONSTRAINT commande_items_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;

ALTER TABLE public.commande_files DROP CONSTRAINT IF EXISTS commande_files_commande_id_fkey;
ALTER TABLE public.commande_files
  ADD CONSTRAINT commande_files_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;

ALTER TABLE public.bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_commande_id_fkey;
ALTER TABLE public.bons_livraison
  ADD CONSTRAINT bons_livraison_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;
ALTER TABLE public.bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_client_id_fkey;
ALTER TABLE public.bons_livraison
  ADD CONSTRAINT bons_livraison_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_commande_id_fkey;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_client_id_fkey;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_client_id_fkey;
ALTER TABLE public.devis
  ADD CONSTRAINT devis_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_commande_id_fkey;
ALTER TABLE public.devis
  ADD CONSTRAINT devis_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE SET NULL;

ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_commande_id_fkey;
ALTER TABLE public.status_history
  ADD CONSTRAINT status_history_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;

ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_commande_id_fkey;
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_commande_id_fkey
  FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;

-- Add explicit WITH CHECK to clients_update policy so Design/Marketing can save edits
DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'super_admin'::app_role) OR
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'marketing'::app_role) OR
    has_role(auth.uid(),'design'::app_role) OR
    has_role(auth.uid(),'dtf'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(),'super_admin'::app_role) OR
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'marketing'::app_role) OR
    has_role(auth.uid(),'design'::app_role) OR
    has_role(auth.uid(),'dtf'::app_role)
  );
