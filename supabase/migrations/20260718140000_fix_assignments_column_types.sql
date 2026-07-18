-- Migration: Fix assignments/assignment_submissions UUID type mismatch
-- Run this in the Supabase SQL Editor
--
-- Same class of bug as the daily_attendance fix: users.id and students.id
-- hold Clerk's raw string IDs (text), but assignments.created_by and
-- assignment_submissions.student_id / graded_by were left as uuid.
-- Every assignment creation, student submission, and grading action fails
-- with "invalid input syntax for type uuid".

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_created_by_fkey;
ALTER TABLE public.assignments ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_student_id_fkey;
ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_graded_by_fkey;

ALTER TABLE public.assignment_submissions ALTER COLUMN student_id TYPE text USING student_id::text;
ALTER TABLE public.assignment_submissions ALTER COLUMN graded_by TYPE text USING graded_by::text;

ALTER TABLE public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_submissions
    ADD CONSTRAINT assignment_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id) ON DELETE SET NULL;
