-- Admission numbers are unique per school, not globally.
--
-- students.admission_number carried a global UNIQUE constraint, so the first
-- school to register "001" locked that number out for every other school. The
-- API only ever checked for duplicates inside the caller's own school, so the
-- check passed and the INSERT then failed with a raw
--   duplicate key value violates unique constraint "students_admission_number_key"
--
-- academic_years and grade_streams were already scoped this way
-- (UNIQUE (school_id, ...)); students were missed.
--
-- A student's school lives on users.school_id, and Postgres cannot index across
-- tables, so students carries its own school_id. It is maintained by trigger
-- rather than by each caller: four separate routes insert students (add-student,
-- bulk import, create-user, self-registration) and a trigger keeps them all
-- correct without repeating the lookup in each one.
--
-- This migration does not delete any rows. It adds a column, backfills it,
-- and swaps one constraint for another; the only DROP is of the old constraint
-- itself. The FK below mirrors users.school_id (ON DELETE CASCADE), which,
-- combined with the existing students.id -> users.id cascade, means it opens no
-- deletion path that did not already exist.

-- 1. Denormalised school_id, backfilled from the owning user row.
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

UPDATE students s
SET school_id = u.school_id
FROM users u
WHERE u.id = s.id
  AND s.school_id IS DISTINCT FROM u.school_id;

-- 2. Keep it in step with the user row on the way in. students.id is a FK to
--    users.id, so the user always exists by the time this fires.
CREATE OR REPLACE FUNCTION set_student_school_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT u.school_id INTO NEW.school_id FROM users u WHERE u.id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_student_school_id ON students;
CREATE TRIGGER trigger_set_student_school_id
    BEFORE INSERT OR UPDATE OF id ON students
    FOR EACH ROW EXECUTE FUNCTION set_student_school_id();

-- 3. Follow the student if their user is moved to another school.
CREATE OR REPLACE FUNCTION sync_student_school_id()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE students SET school_id = NEW.school_id WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_student_school_id ON users;
CREATE TRIGGER trigger_sync_student_school_id
    AFTER UPDATE OF school_id ON users
    FOR EACH ROW
    WHEN (NEW.school_id IS DISTINCT FROM OLD.school_id)
    EXECUTE FUNCTION sync_student_school_id();

-- 4. Every existing student resolves to a school, so this is enforceable now.
--    It also matters for correctness below: NULLs are distinct in a UNIQUE
--    constraint, so a NULL school_id would let duplicates slip through.
ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;

-- 5. Swap the global constraint for the per-school one. admission_number stays
--    nullable (it is auto-generated when omitted) and NULLs remain distinct, so
--    students still awaiting a number do not collide with each other.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_admission_number_key;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_school_id_admission_number_key;
ALTER TABLE students ADD CONSTRAINT students_school_id_admission_number_key
    UNIQUE (school_id, admission_number);
