-- Fix: Only auto-calculate grade if NOT provided (allow teachers to manually set grades)

CREATE OR REPLACE FUNCTION calculate_exam_mark_grade()
RETURNS TRIGGER AS $$
DECLARE
    v_max_score NUMERIC;
    v_academic_level_id UUID;
    v_grading_system_id UUID;
    v_grade_symbol TEXT;
BEGIN
    SELECT max_score INTO v_max_score FROM exams WHERE id = NEW.exam_id;
    
    IF v_max_score > 0 THEN
        NEW.percentage := (NEW.raw_score / v_max_score) * 100;
    ELSE
        NEW.percentage := 0;
    END IF;
    
    IF NEW.grade_symbol IS NULL OR NEW.grade_symbol = '' THEN
        SELECT academic_level_id INTO v_academic_level_id FROM students WHERE id = NEW.student_id;
        SELECT id INTO v_grading_system_id FROM grading_systems WHERE academic_level_id = v_academic_level_id LIMIT 1;

        SELECT symbol INTO v_grade_symbol
        FROM grading_scales
        WHERE grading_system_id = v_grading_system_id
          AND NEW.percentage >= min_percentage
          AND NEW.percentage <= max_percentage
        ORDER BY min_percentage DESC
        LIMIT 1;
        
        NEW.grade_symbol := v_grade_symbol;
    END IF;
    
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
