-- Changing a class's class teacher took two separate edits (release the
-- class from its teacher, then give it to the new one), and a direct
-- assignment was refused with "This class already has a class teacher".
-- set_class_teacher does the whole change in one transaction:
--   * the class's current class teacher (if any, and not the new one) is
--     released and, if they were a CLASS_TEACHER, becomes a SUBJECT_TEACHER;
--   * the new teacher's own class this year (if any) moves to this class,
--     so a teacher never holds two classes (UNIQUE user_id, academic_year_id);
--   * the new teacher, if a SUBJECT_TEACHER, becomes a CLASS_TEACHER.
-- p_user_id NULL just releases the class. Returns who was replaced and which
-- class the new teacher left, for the caller to report.
CREATE OR REPLACE FUNCTION public.set_class_teacher(
    p_school_id uuid,
    p_stream_id uuid,
    p_user_id text,
    p_year_id uuid
)
RETURNS TABLE (previous_teacher_id text, moved_from_stream_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_previous text;
    v_moved_from uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM grade_streams WHERE id = p_stream_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'Class not found in this school.' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_year_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'Academic year not found in this school.' USING ERRCODE = 'P0002';
    END IF;
    IF p_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = p_user_id AND school_id = p_school_id AND is_active
          AND role IN ('CLASS_TEACHER', 'SUBJECT_TEACHER')
    ) THEN
        RAISE EXCEPTION 'Only an active teacher at this school can be a class teacher.' USING ERRCODE = 'P0001';
    END IF;

    SELECT user_id INTO v_previous
    FROM class_teachers
    WHERE current_grade_stream_id = p_stream_id AND academic_year_id = p_year_id
    FOR UPDATE;

    IF v_previous IS NOT DISTINCT FROM p_user_id THEN
        RETURN QUERY SELECT v_previous, NULL::uuid;
        RETURN;
    END IF;

    IF v_previous IS NOT NULL THEN
        DELETE FROM class_teachers
        WHERE current_grade_stream_id = p_stream_id AND academic_year_id = p_year_id;
        UPDATE users SET role = 'SUBJECT_TEACHER' WHERE id = v_previous AND role = 'CLASS_TEACHER';
    END IF;

    IF p_user_id IS NOT NULL THEN
        SELECT current_grade_stream_id INTO v_moved_from
        FROM class_teachers
        WHERE user_id = p_user_id AND academic_year_id = p_year_id
        FOR UPDATE;

        IF v_moved_from IS NOT NULL THEN
            UPDATE class_teachers SET current_grade_stream_id = p_stream_id
            WHERE user_id = p_user_id AND academic_year_id = p_year_id;
        ELSE
            INSERT INTO class_teachers (user_id, current_grade_stream_id, academic_year_id)
            VALUES (p_user_id, p_stream_id, p_year_id);
        END IF;
        UPDATE users SET role = 'CLASS_TEACHER' WHERE id = p_user_id AND role = 'SUBJECT_TEACHER';
    END IF;

    RETURN QUERY SELECT v_previous, v_moved_from;
END;
$$;

-- Server only, like the other admin rollups: the API checks the caller is the
-- school's admin before calling it.
REVOKE EXECUTE ON FUNCTION public.set_class_teacher(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_class_teacher(uuid, uuid, text, uuid) TO service_role;
