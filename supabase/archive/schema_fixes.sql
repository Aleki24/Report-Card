-- Fix global unique constraints that prevent multi-tenant isolation

-- 1. Ensure school_id exists on key tables
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE grade_streams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 2. Academic Years: Scope name uniqueness to the school
ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS academic_years_name_key;
ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS academic_years_school_id_name_key;
ALTER TABLE academic_years ADD CONSTRAINT academic_years_school_id_name_key UNIQUE (school_id, name);

-- 3. Grade Streams: Scope uniqueness to the school and grade
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_grade_id_name_key;
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_school_id_grade_id_name_key;
ALTER TABLE grade_streams ADD CONSTRAINT grade_streams_school_id_grade_id_name_key UNIQUE (school_id, grade_id, name);

-- 4. Students: Remove global unique constraint on admission_number
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_admission_number_key;

-- 5. Fix generate_term_reports function mismatch (API only passes term_id and grade_stream_id)
DROP FUNCTION IF EXISTS generate_term_reports(UUID, UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION generate_term_reports(
    p_term_id UUID,
    p_grade_stream_id UUID
)
RETURNS void AS $$
DECLARE
    v_academic_year_id UUID;
BEGIN
    -- 1. Get the academic_year_id from the term
    SELECT academic_year_id INTO v_academic_year_id FROM terms WHERE id = p_term_id;
    
    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'Term not found or has no associated academic year.';
    END IF;

    -- 2. Verify caller is ADMIN or the assigned CLASS_TEACHER for this stream/year
    IF get_my_role() != 'ADMIN' THEN
        IF NOT EXISTS (
            SELECT 1 FROM class_teachers 
            WHERE user_id = auth.uid() 
              AND current_grade_stream_id = p_grade_stream_id 
              AND academic_year_id = v_academic_year_id
        ) THEN
            RAISE EXCEPTION 'Not authorized to generate reports for this class stream.';
        END IF;
    END IF;

    -- 3. Upsert master report_cards records for all active students in the stream
    INSERT INTO report_cards (student_id, academic_year_id, term_id, grade_stream_id, generated_by_user_id)
    SELECT id, v_academic_year_id, p_term_id, p_grade_stream_id, auth.uid()
    FROM students
    WHERE current_grade_stream_id = p_grade_stream_id AND status = 'ACTIVE'
    ON CONFLICT (student_id, academic_year_id, term_id) 
    DO UPDATE SET 
        generated_at = now(),
        generated_by_user_id = auth.uid();

    -- 4. Clear old report card subjects for these report cards
    DELETE FROM report_card_subjects 
    WHERE report_card_id IN (
        SELECT id FROM report_cards
        WHERE grade_stream_id = p_grade_stream_id
          AND academic_year_id = v_academic_year_id
          AND term_id = p_term_id
    );

    -- 5. Calculate per-subject aggregates for all students in bulk
    INSERT INTO report_card_subjects (report_card_id, subject_id, total_score, total_max_score, percentage)
    SELECT 
        rc.id as report_card_id,
        e.subject_id,
        SUM(em.raw_score),
        SUM(e.max_score),
        CASE WHEN SUM(e.max_score) > 0 THEN (SUM(em.raw_score) / SUM(e.max_score)) * 100 ELSE 0 END
    FROM report_cards rc
    JOIN exam_marks em ON em.student_id = rc.student_id
    JOIN exams e ON e.id = em.exam_id
    WHERE rc.grade_stream_id = p_grade_stream_id
      AND rc.academic_year_id = v_academic_year_id
      AND rc.term_id = p_term_id
      AND e.academic_year_id = v_academic_year_id
      AND e.term_id = p_term_id
    GROUP BY rc.id, e.subject_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
