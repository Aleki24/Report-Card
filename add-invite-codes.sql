-- Add invite code columns to schools
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS teacher_invite_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS student_invite_code VARCHAR(20);

-- Create a function to auto-generate invite codes for new schools
CREATE OR REPLACE FUNCTION generate_school_invite_codes()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate simple 6-character alphanumeric codes
    NEW.teacher_invite_code := 'T-' || substring(md5(random()::text) from 1 for 6);
    NEW.student_invite_code := 'S-' || substring(md5(random()::text) from 1 for 6);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run before insert on schools
DROP TRIGGER IF EXISTS trigger_generate_school_invite_codes ON schools;
CREATE TRIGGER trigger_generate_school_invite_codes
    BEFORE INSERT ON schools
    FOR EACH ROW
    EXECUTE FUNCTION generate_school_invite_codes();

-- Backfill existing schools that don't have codes
UPDATE schools 
SET teacher_invite_code = 'T-' || substring(md5(random()::text) from 1 for 6)
WHERE teacher_invite_code IS NULL;

UPDATE schools 
SET student_invite_code = 'S-' || substring(md5(random()::text) from 1 for 6)
WHERE student_invite_code IS NULL;

-- Ensure codes are unique
ALTER TABLE schools ADD CONSTRAINT schools_teacher_code_unique UNIQUE (teacher_invite_code);
ALTER TABLE schools ADD CONSTRAINT schools_student_code_unique UNIQUE (student_invite_code);

-- Also add PENDING to valid user roles (it might already be in there, but just in case)
-- PostgreSQL enums cannot be easily altered if they are already used, but we'll try to add it.
-- We check if PENDING exists first
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'PENDING') THEN
        ALTER TYPE user_role ADD VALUE 'PENDING';
    END IF;
END
$$;
