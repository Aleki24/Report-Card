-- Allow each school to create/edit/delete its own grading systems, while the
-- two seeded national-curriculum defaults (CBC / 8-4-4, school_id IS NULL)
-- stay shared, read-only reference data for every school.

ALTER TABLE grading_systems ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_grading_systems_school ON grading_systems(school_id);

-- A school deleting its own custom grading system should detach it from any
-- subject using it, not fail with a foreign-key violation.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_grading_system_id_fkey;
ALTER TABLE subjects ADD CONSTRAINT subjects_grading_system_id_fkey
    FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE SET NULL;
