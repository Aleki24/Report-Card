-- assignment_submissions.student_id carried two identical foreign keys to
-- students (assignment_submissions_student_id_fkey and
-- fk_assignment_submissions_student_id). PostgREST cannot choose between them,
-- so every embed of students from a submission failed (HTTP 300, PGRST201)
-- and the Submissions tab showed "Unknown error". Keep the schema's own one.
ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS fk_assignment_submissions_student_id;

NOTIFY pgrst, 'reload schema';
