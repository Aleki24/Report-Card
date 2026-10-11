-- Trigger and helper functions were executable by the public roles (anon,
-- authenticated) through the publishable key. None are SECURITY DEFINER and
-- those roles have no table rights, so calls failed anyway; this removes the
-- surface. The server (service_role keeps its own grant) and the triggers
-- keep working.
DO $$
DECLARE f record;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('calculate_exam_mark_grade', 'generate_receipt_number', 'generate_school_invite_codes',
                            'set_student_school_id', 'sync_student_fee_totals', 'sync_student_school_id',
                            'touch_exam_mark_component', 'touch_student_subject', 'touch_subject_combination')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    END LOOP;
END $$;
