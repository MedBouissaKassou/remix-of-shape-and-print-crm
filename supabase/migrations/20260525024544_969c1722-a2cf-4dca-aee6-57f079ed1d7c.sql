DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['documents','commande-files','client-files','dtf-excel','ticket-files']
  LOOP
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)', 'auth read '||b, b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)', 'auth insert '||b, b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L)', 'auth update '||b, b, b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L)', 'auth delete '||b, b);
  END LOOP;
END $$;