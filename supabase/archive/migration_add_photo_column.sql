-- Add photo/avatar column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add photo/avatar column to users table (for teachers/staff)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
