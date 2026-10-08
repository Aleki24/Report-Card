-- A learner's account is activated by moving their students row from the
-- id the school created to their sign-in (Clerk) id: UPDATE students SET id.
-- Every foreign key to students(id) was ON UPDATE NO ACTION, so once the
-- learner had a single mark, subject, guardian or fee row the update was
-- refused (23503 on fk_exam_marks_student_id) and activation failed with
-- "Failed to link your student record". Let the new id carry to every
-- referencing row instead.
--
-- daily_attendance also carried a second, identical key to students; two
-- keys make PostgREST refuse to embed students (as assignment_submissions'
-- duplicate broke the Submissions tab), so the duplicate goes.
ALTER TABLE public.daily_attendance DROP CONSTRAINT IF EXISTS fk_daily_attendance_student_id;

DO $$
DECLARE
    fk record;
BEGIN
    FOR fk IN
        SELECT c.conname, c.conrelid::regclass AS tbl, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND c.confrelid = 'public.students'::regclass
          AND c.confupdtype <> 'c'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON UPDATE CASCADE', fk.tbl, fk.conname, fk.def);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
