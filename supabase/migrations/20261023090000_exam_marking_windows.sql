-- Which exam each class is marking now, chosen by the school.
--
-- Every exam of a term exists from its first day, so teachers picked an exam
-- for themselves and Mid-Term marks landed in End-Term. The admin now says
-- which exam is open for each class (set per level, e.g. all of Junior School,
-- or per class where one differs, e.g. Form 4 sitting Mock), and teachers go
-- straight to it. Exams that can be given any time (CATs, topical tests, a
-- school's own types) need no row here.
CREATE TABLE IF NOT EXISTS public.exam_marking_windows (
    school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id    uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    -- grades are shared between schools; school_id scopes the row.
    grade_id   uuid NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
    exam_type  text NOT NULL,
    set_by     text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (school_id, term_id, grade_id)
);

ALTER TABLE public.exam_marking_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_marking_windows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_marking_windows TO service_role;

-- A teacher asking for an exam to be opened for a class. Shown to whoever
-- can open exams (admins, the principal, deputy, DOS, exams officer) and
-- cleared once an exam is opened for that class.
CREATE TABLE IF NOT EXISTS public.exam_marking_requests (
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id      uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    grade_id     uuid NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
    requested_by text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (school_id, term_id, grade_id, requested_by)
);

ALTER TABLE public.exam_marking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_marking_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_marking_requests TO service_role;
