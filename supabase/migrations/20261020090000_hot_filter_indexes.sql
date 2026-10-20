-- Indexes for the filters the API uses on every page, which had none:
-- exams by school and term (and grade), a learner's marks, a class's
-- learners, a school's users and a term's fees. Small tables today; these
-- keep the pages fast as schools add years of exams and marks.
CREATE INDEX IF NOT EXISTS idx_exams_school_term ON public.exams (school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_exams_grade ON public.exams (grade_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON public.exam_marks (student_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_stream ON public.students (current_grade_stream_id);
CREATE INDEX IF NOT EXISTS idx_users_school ON public.users (school_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_term ON public.student_fees (term_id);
