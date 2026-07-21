-- ================================================================
-- Multi-paper (multi-component) subject support
-- ================================================================
-- Adds OPTIONAL per-exam paper/component configuration so subjects
-- like KCSE Mathematics (P1+P2), English/Kiswahili (P1+P2+P3) and
-- Sciences (P1+P2 theory + P3 practical) can be marked per paper and
-- resolved into ONE final subject score.
--
-- Design notes:
--  * Each `exams` row is already scoped to a single subject, so a
--    scheme is keyed by exam_id (subject_id kept denormalised for
--    convenient querying).
--  * The RESOLVED result is still stored in `exam_marks`, normalised
--    to the exam's max_score:
--        raw_score  = final_percentage / 100 * exams.max_score
--        percentage = final_percentage
--    This keeps every existing consumer (grading trigger, report RPC,
--    analytics, ranking, PDFs) working unchanged. Paper-level raw
--    scores live in `exam_mark_components` for breakdown views.
--  * Exams without a scheme (or with a disabled scheme) behave exactly
--    as before — this feature is opt-in per exam subject.
-- ================================================================

-- 1. Component scheme per exam subject
CREATE TABLE IF NOT EXISTS exam_subject_component_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    assessment_mode TEXT NOT NULL DEFAULT 'single_paper'
        CHECK (assessment_mode IN ('single_paper', 'multi_paper')),
    aggregation_method TEXT NOT NULL DEFAULT 'sum_then_percentage'
        CHECK (aggregation_method IN (
            'sum_then_percentage',
            'languages_average_percentages',
            'science_70_plus_practical'
        )),
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (exam_id)
);

-- 2. Paper/component definitions for a scheme
CREATE TABLE IF NOT EXISTS exam_subject_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID REFERENCES exam_subject_component_schemes(id) ON DELETE CASCADE NOT NULL,
    component_code TEXT NOT NULL,              -- 'P1', 'P2', 'P3'
    component_name TEXT NOT NULL,              -- 'Paper 1'
    max_score NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
    weight NUMERIC(5,2),                       -- reserved for custom-weight methods
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (scheme_id, component_code)
);

-- 3. Per-student score for each paper/component
--    NOTE: student_id is TEXT because the production database stores
--    Clerk user IDs (users.id / students.id were converted to TEXT —
--    see supabase/archive/fix-users-id-type.sql). supabase_schema.sql
--    (fresh installs) still declares them UUID; adjust to UUID there.
CREATE TABLE IF NOT EXISTS exam_mark_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    component_id UUID REFERENCES exam_subject_components(id) ON DELETE CASCADE NOT NULL,
    raw_score NUMERIC(6,2) NOT NULL CHECK (raw_score >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (component_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_escs_exam_id ON exam_subject_component_schemes(exam_id);
CREATE INDEX IF NOT EXISTS idx_esc_scheme_id ON exam_subject_components(scheme_id);
CREATE INDEX IF NOT EXISTS idx_emc_exam_id ON exam_mark_components(exam_id);
CREATE INDEX IF NOT EXISTS idx_emc_student_id ON exam_mark_components(student_id);

-- RLS
ALTER TABLE exam_subject_component_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subject_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_mark_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read component schemes" ON exam_subject_component_schemes;
CREATE POLICY "Authenticated read component schemes" ON exam_subject_component_schemes
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and exam creators manage component schemes" ON exam_subject_component_schemes;
CREATE POLICY "Admins and exam creators manage component schemes" ON exam_subject_component_schemes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = exam_subject_component_schemes.exam_id
              AND e.created_by_teacher_id::text = auth.uid()::text
        )
        OR get_my_role() = 'ADMIN'
    );

DROP POLICY IF EXISTS "Authenticated read components" ON exam_subject_components;
CREATE POLICY "Authenticated read components" ON exam_subject_components
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and exam creators manage components" ON exam_subject_components;
CREATE POLICY "Admins and exam creators manage components" ON exam_subject_components
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_subject_component_schemes s
            JOIN exams e ON e.id = s.exam_id
            WHERE s.id = exam_subject_components.scheme_id
              AND e.created_by_teacher_id::text = auth.uid()::text
        )
        OR get_my_role() = 'ADMIN'
    );

DROP POLICY IF EXISTS "Students view their own component marks" ON exam_mark_components;
CREATE POLICY "Students view their own component marks" ON exam_mark_components
    FOR SELECT USING (
        student_id = auth.uid()::text
        OR get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER')
    );

DROP POLICY IF EXISTS "Teachers manage component marks for their exams" ON exam_mark_components;
CREATE POLICY "Teachers manage component marks for their exams" ON exam_mark_components
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = exam_mark_components.exam_id
              AND e.created_by_teacher_id::text = auth.uid()::text
        )
        OR get_my_role() = 'ADMIN'
    );

-- updated_at maintenance for component marks
CREATE OR REPLACE FUNCTION touch_exam_mark_component()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_exam_mark_component ON exam_mark_components;
CREATE TRIGGER trigger_touch_exam_mark_component
BEFORE UPDATE ON exam_mark_components
FOR EACH ROW
EXECUTE FUNCTION touch_exam_mark_component();

-- ================================================================
-- DEMO / VALIDATION EXAMPLES (reference only — do not run blindly)
-- ================================================================
-- Example 1: Mathematics, 2 papers, sum_then_percentage
--   P1 = 56/80, P2 = 44/60  →  (56+44)/(80+60)×100 = 71.43%
--
-- INSERT INTO exam_subject_component_schemes (exam_id, subject_id, school_id, assessment_mode, aggregation_method)
-- VALUES ('<maths-exam-id>', '<maths-subject-id>', '<school-id>', 'multi_paper', 'sum_then_percentage');
-- INSERT INTO exam_subject_components (scheme_id, component_code, component_name, max_score, display_order) VALUES
--   ('<scheme-id>', 'P1', 'Paper 1', 80, 1),
--   ('<scheme-id>', 'P2', 'Paper 2', 60, 2);
--
-- Example 2: English, 3 papers, languages_average_percentages
--   P1 = 24/40 (60%), P2 = 36/60 (60%), P3 = 18/20 (90%) → (60+60+90)/3 = 70%
--
-- Example 3: Biology, 3 papers, science_70_plus_practical
--   Theory: (25+50)/(40+60)×70 = 52.5, Practical: 24/30×30 = 24 → 76.5%
--   The LAST component by display_order is treated as the practical paper.
-- ================================================================
