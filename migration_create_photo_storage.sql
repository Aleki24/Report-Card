-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
SELECT 'photos', 'photos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'photos');

-- Public read access
DROP POLICY IF EXISTS "Photos public read" ON storage.objects;
CREATE POLICY "Photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Photos authenticated upload" ON storage.objects;
CREATE POLICY "Photos authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Photos authenticated update" ON storage.objects;
CREATE POLICY "Photos authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Photos authenticated delete" ON storage.objects;
CREATE POLICY "Photos authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');
