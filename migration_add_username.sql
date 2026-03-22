-- Migration: Add username support for teacher/student authentication
-- Run this in your Supabase SQL Editor

-- 1. Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 2. Add username column to pending_invites table
ALTER TABLE pending_invites ADD COLUMN IF NOT EXISTS username TEXT;

-- 3. Backfill usernames for existing non-admin users
-- This generates usernames in the format: firstname + schoolname + row_number
-- e.g. "alexshalom1"
DO $$
DECLARE
    r RECORD;
    v_school_name TEXT;
    v_username TEXT;
    v_seq INT;
    v_candidate TEXT;
BEGIN
    v_seq := 1;
    FOR r IN
        SELECT u.id, u.first_name, u.school_id, u.role
        FROM users u
        WHERE u.role != 'ADMIN' AND u.username IS NULL
        ORDER BY u.created_at
    LOOP
        -- Get the school name
        SELECT LOWER(REGEXP_REPLACE(s.name, '[^a-zA-Z0-9]', '', 'g'))
        INTO v_school_name
        FROM schools s WHERE s.id = r.school_id;

        IF v_school_name IS NULL THEN
            v_school_name := 'school';
        END IF;

        v_candidate := LOWER(REGEXP_REPLACE(r.first_name, '[^a-zA-Z0-9]', '', 'g'))
                       || v_school_name || v_seq;

        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM users WHERE username = v_candidate) LOOP
            v_seq := v_seq + 1;
            v_candidate := LOWER(REGEXP_REPLACE(r.first_name, '[^a-zA-Z0-9]', '', 'g'))
                           || v_school_name || v_seq;
        END LOOP;

        UPDATE users SET username = v_candidate WHERE id = r.id;
        v_seq := v_seq + 1;
    END LOOP;
END $$;

-- 4. Verify
SELECT id, first_name, last_name, username, role FROM users ORDER BY created_at;
