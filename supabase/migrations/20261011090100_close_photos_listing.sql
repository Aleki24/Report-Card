-- The photos bucket had a SELECT policy for everyone, so anyone holding the
-- publishable key could LIST every school's photos (learner photos, homework
-- photos, logos) through the storage API. Photos are served by their public
-- URLs, which do not use these policies, and the server reads and writes
-- storage with the service role, which bypasses them. The upload/update/
-- delete policies were for Supabase Auth sessions, which this app does not
-- use (it signs in with Clerk).
DROP POLICY IF EXISTS "Photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Photos authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Photos authenticated delete" ON storage.objects;
