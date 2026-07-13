DROP POLICY IF EXISTS documents_insert_roles ON storage.objects;
DROP POLICY IF EXISTS documents_update_roles ON storage.objects;
DROP POLICY IF EXISTS documents_delete_roles ON storage.objects;

CREATE POLICY documents_insert_roles ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
  )
);

CREATE POLICY documents_update_roles ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
  )
);

CREATE POLICY documents_delete_roles ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
  )
);

-- Also extend bons_livraison/devis/factures row policies to allow admin
DROP POLICY IF EXISTS bl_insert ON public.bons_livraison;
CREATE POLICY bl_insert ON public.bons_livraison FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'design'::app_role));

DROP POLICY IF EXISTS bl_update ON public.bons_livraison;
CREATE POLICY bl_update ON public.bons_livraison FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role) OR has_role(auth.uid(),'design'::app_role));

DROP POLICY IF EXISTS bl_delete ON public.bons_livraison;
CREATE POLICY bl_delete ON public.bons_livraison FOR DELETE TO authenticated
USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'marketing'::app_role));