DROP POLICY IF EXISTS dtf_insert_roles ON storage.objects;
DROP POLICY IF EXISTS dtf_update_roles ON storage.objects;
DROP POLICY IF EXISTS dtf_delete_roles ON storage.objects;

CREATE POLICY dtf_insert_roles ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dtf-excel'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
    OR has_role(auth.uid(), 'dtf'::app_role)
  )
);

CREATE POLICY dtf_update_roles ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'dtf-excel'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
    OR has_role(auth.uid(), 'dtf'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'dtf-excel'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
    OR has_role(auth.uid(), 'dtf'::app_role)
  )
);

CREATE POLICY dtf_delete_roles ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'dtf-excel'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_role(auth.uid(), 'design'::app_role)
    OR has_role(auth.uid(), 'dtf'::app_role)
  )
);
