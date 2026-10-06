-- Assignments lost their foreign keys to subjects, classes and schools, so
-- PostgREST could not embed `subjects!subject_id` / `grade_streams!grade_stream_id`
-- and GET /api/school/assignments failed with PGRST200: the Assignments page
-- loaded forever on the web and the app. Restore them.

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_subject_id_fkey;
ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_grade_stream_id_fkey;
ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES public.grade_streams(id) ON DELETE SET NULL;

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_school_id_fkey;
ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS assignments_school_due_idx ON public.assignments (school_id, due_date);

NOTIFY pgrst, 'reload schema';
