-- Migration: Add invite code columns to schools table
-- Run this on the live Supabase database to add missing columns

-- 1. Add invite code columns to schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS teacher_invite_code TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_invite_code TEXT;

-- 2. Auto-generate invite codes for any existing schools that don't have them
UPDATE schools
SET teacher_invite_code = UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6))
WHERE teacher_invite_code IS NULL;

UPDATE schools
SET student_invite_code = UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6))
WHERE student_invite_code IS NULL;
