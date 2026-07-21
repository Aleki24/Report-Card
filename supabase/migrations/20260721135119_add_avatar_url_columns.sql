-- Re-adds avatar_url to users and students. An earlier copy of this migration
-- lived in supabase/archive/migration_add_photo_column.sql marked as "already
-- applied" — it wasn't, on at least one live database, which broke every
-- query selecting users.avatar_url (e.g. the Teachers list) with
-- "column users.avatar_url does not exist". Tracked here so the Supabase CLI
-- can apply it going forward.
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
