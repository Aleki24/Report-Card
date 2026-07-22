-- ================================================================
-- CBC Senior School (Grades 10-12) pathways & subject combinations
-- ================================================================
-- Kenya CBC senior school: every learner takes 7 subjects — 4
-- compulsory cores (English/KSL, Kiswahili, Community Service
-- Learning, Physical Education) + 3 electives chosen from the three
-- official pathways (STEM, Social Sciences, Arts & Sports Science),
-- each split into tracks. The Ministry publishes "subject
-- combination" codes (track + exact 3 electives), and a combination
-- needs a minimum of 15 learners to run as a class group.
--
-- Design notes:
--  * `subject_combinations` is school-defined (seeded from ministry
--    templates in the UI); its 3 electives live in the
--    `subject_combination_subjects` junction table.
--  * `student_subjects` is the student<->subject enrollment junction
--    (role CORE or ELECTIVE). Rows are synced server-side whenever a
--    student's combination is (re)assigned. Students with NO rows
--    keep today's behaviour (all subjects at their academic level).
--  * `students.pathway` / `track` / `subject_combination_id` are all
--    nullable — 8-4-4 students and junior-school CBC students are
--    completely unaffected.
--  * `schools.min_combination_group_size` (default 15) drives the
--    "separate report document per combination vs combined document"
--    split during report generation.
--  * student_id is TEXT because the production database stores Clerk
--    user IDs (users.id / students.id were converted to TEXT — see
--    supabase/archive/fix-users-id-type.sql). supabase_schema.sql
--    (fresh installs) still declares them UUID; adjusted there.
-- ================================================================

-- 0. Pathway enum (CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cbc_pathway') THEN
        CREATE TYPE cbc_pathway AS ENUM ('STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS');
    END IF;
END $$;

-- 1. Subject combinations (ministry codes, school-scoped)
CREATE TABLE IF NOT EXISTS subject_combinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,                 -- ministry code, e.g. 'SPORTS'
    name TEXT NOT NULL,                 -- e.g. 'Sports Science'
    pathway cbc_pathway NOT NULL,
    track TEXT,                         -- e.g. 'Pure Sciences'
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, code)
);

-- 2. The exact 3 electives of a combination
--    (exactly-3 is enforced in the API layer so PATCH transitions
--    can delete+reinsert without tripping a DB constraint)
CREATE TABLE IF NOT EXISTS subject_combination_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combination_id UUID REFERENCES subject_combinations(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (combination_id, subject_id)
);

-- 3. Student <-> subject enrollment (4 cores + 3 electives)
CREATE TABLE IF NOT EXISTS student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'ELECTIVE' CHECK (role IN ('CORE', 'ELECTIVE')),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, subject_id)
);

-- 4. Student pathway assignment columns (all nullable — opt-in)
ALTER TABLE students ADD COLUMN IF NOT EXISTS pathway cbc_pathway;
ALTER TABLE students ADD COLUMN IF NOT EXISTS track TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS subject_combination_id UUID
    REFERENCES subject_combinations(id) ON DELETE SET NULL;

-- 5. Ministry minimum learners per combination class group
ALTER TABLE schools ADD COLUMN IF NOT EXISTS min_combination_group_size INT DEFAULT 15 NOT NULL;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_subject_combinations_school_id ON subject_combinations(school_id);
CREATE INDEX IF NOT EXISTS idx_scs_combination_id ON subject_combination_subjects(combination_id);
CREATE INDEX IF NOT EXISTS idx_scs_subject_id ON subject_combination_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id ON student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_school_id ON student_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_students_subject_combination_id ON students(subject_combination_id);

-- 7. RLS
ALTER TABLE subject_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_combination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read subject combinations" ON subject_combinations;
CREATE POLICY "Authenticated read subject combinations" ON subject_combinations
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage subject combinations" ON subject_combinations;
CREATE POLICY "Admins manage subject combinations" ON subject_combinations
    FOR ALL USING (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Authenticated read combination subjects" ON subject_combination_subjects;
CREATE POLICY "Authenticated read combination subjects" ON subject_combination_subjects
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage combination subjects" ON subject_combination_subjects;
CREATE POLICY "Admins manage combination subjects" ON subject_combination_subjects
    FOR ALL USING (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Students view their own subject enrollments" ON student_subjects;
CREATE POLICY "Students view their own subject enrollments" ON student_subjects
    FOR SELECT USING (
        student_id = auth.uid()::text
        OR get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER')
    );

DROP POLICY IF EXISTS "Class teachers and admins manage subject enrollments" ON student_subjects;
CREATE POLICY "Class teachers and admins manage subject enrollments" ON student_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_teachers ct
            JOIN students s ON s.current_grade_stream_id = ct.current_grade_stream_id
            WHERE ct.user_id::text = auth.uid()::text
              AND s.id = student_subjects.student_id
        )
        OR get_my_role() = 'ADMIN'
    );

-- 8. updated_at maintenance
CREATE OR REPLACE FUNCTION touch_subject_combination()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_subject_combination ON subject_combinations;
CREATE TRIGGER trigger_touch_subject_combination
BEFORE UPDATE ON subject_combinations
FOR EACH ROW
EXECUTE FUNCTION touch_subject_combination();

CREATE OR REPLACE FUNCTION touch_student_subject()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_student_subject ON student_subjects;
CREATE TRIGGER trigger_touch_student_subject
BEFORE UPDATE ON student_subjects
FOR EACH ROW
EXECUTE FUNCTION touch_student_subject();

-- ================================================================
-- VALIDATION EXAMPLES (reference only — do not run blindly)
-- ================================================================
-- Example: create the ministry SPORTS combination
--   (Biology + Geography + Sports & Recreation)
--
-- INSERT INTO subject_combinations (school_id, code, name, pathway, track)
-- VALUES ('<school-id>', 'SPORTS', 'Sports Science', 'ARTS_SPORTS', 'Sports Science');
-- INSERT INTO subject_combination_subjects (combination_id, subject_id)
-- SELECT '<combination-id>', id FROM subjects
--  WHERE school_id = '<school-id>' AND code IN ('BIO_SS', 'GEO_SS', 'SR_SS');
--
-- Learners per combination (min 15 to run as a class group):
-- SELECT sc.code, COUNT(st.id) AS learners
--   FROM subject_combinations sc
--   LEFT JOIN students st ON st.subject_combination_id = sc.id AND st.status = 'ACTIVE'
--  GROUP BY sc.code;
--
-- Every assigned student should have exactly 7 enrollments (4 CORE + 3 ELECTIVE):
-- SELECT student_id, COUNT(*) FILTER (WHERE role = 'CORE') AS cores,
--        COUNT(*) FILTER (WHERE role = 'ELECTIVE') AS electives
--   FROM student_subjects GROUP BY student_id
--  HAVING COUNT(*) FILTER (WHERE role = 'ELECTIVE') <> 3;
-- ================================================================
