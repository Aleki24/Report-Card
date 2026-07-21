# ============================================
# Migration: Remove plain_password column
# ============================================
-- This migration removes the plain_password column from the users table
-- and cleans up any user CRUD routes that depend on it.

ALTER TABLE users DROP COLUMN IF EXISTS plain_password;

-- Optional: Drop the now-unused add_plain_password migration artifacts
DROP FUNCTION IF EXISTS get_my_password() CASCADE;
