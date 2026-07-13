
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ticket-files select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ticket-files');
CREATE POLICY "ticket-files insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-files');
CREATE POLICY "ticket-files delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ticket-files');
