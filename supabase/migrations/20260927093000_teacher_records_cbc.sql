-- Teachers' professional records (schemes of work, lesson plans, records of
-- work) and CBC rubric assessment. Additive only; service-role only.

-- DRAFT -> SUBMITTED -> APPROVED | RETURNED
CREATE TABLE IF NOT EXISTS public.schemes_of_work (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id       text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id       uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade_stream_id  uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    term_id          uuid REFERENCES public.terms(id) ON DELETE SET NULL,
    title            text NOT NULL,
    status           text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED')),
    review_comment   text,
    reviewed_by      text REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schemes_of_work_teacher ON public.schemes_of_work (school_id, teacher_id);
ALTER TABLE public.schemes_of_work ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.scheme_entries (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    scheme_id   uuid NOT NULL REFERENCES public.schemes_of_work(id) ON DELETE CASCADE,
    week        smallint NOT NULL CHECK (week BETWEEN 1 AND 20),
    lesson      smallint NOT NULL DEFAULT 1 CHECK (lesson BETWEEN 1 AND 20),
    topic       text NOT NULL,
    sub_topic   text,
    objectives  text,
    activities  text,
    resources   text,
    assessment  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scheme_id, week, lesson)
);
ALTER TABLE public.scheme_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id       text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheme_entry_id  uuid REFERENCES public.scheme_entries(id) ON DELETE SET NULL,
    subject_id       uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade_stream_id  uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    lesson_date      date NOT NULL,
    topic            text NOT NULL,
    objectives       text,
    introduction     text,
    development      text,
    conclusion       text,
    resources        text,
    reflection       text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_plans_teacher ON public.lesson_plans (school_id, teacher_id, lesson_date DESC);
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- What was actually taught; feeds syllabus coverage against the scheme.
CREATE TABLE IF NOT EXISTS public.records_of_work (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id       text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheme_entry_id  uuid REFERENCES public.scheme_entries(id) ON DELETE SET NULL,
    subject_id       uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade_stream_id  uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    lesson_date      date NOT NULL DEFAULT CURRENT_DATE,
    work_covered     text NOT NULL,
    remarks          text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS records_of_work_stream_subject ON public.records_of_work (school_id, grade_stream_id, subject_id);
ALTER TABLE public.records_of_work ENABLE ROW LEVEL SECURITY;

-- CBC rubric: Exceeding / Meeting / Approaching / Below Expectations.
CREATE TABLE IF NOT EXISTS public.competency_assessments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id   text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id   uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    term_id      uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    strand       text NOT NULL,
    sub_strand   text NOT NULL DEFAULT '',
    level        text NOT NULL CHECK (level IN ('EE', 'ME', 'AE', 'BE')),
    comment      text,
    assessed_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    assessed_on  date NOT NULL DEFAULT CURRENT_DATE,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, subject_id, term_id, strand, sub_strand)
);
CREATE INDEX IF NOT EXISTS competency_assessments_lookup ON public.competency_assessments (school_id, subject_id, term_id);
ALTER TABLE public.competency_assessments ENABLE ROW LEVEL SECURITY;
