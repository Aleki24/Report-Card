-- Academics office: school calendar, exam paper bank, and timetable.
-- Additive only; every table is service-role only (RLS on, no policies).

-- 1. School calendar -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title       text NOT NULL,
    event_type  text NOT NULL DEFAULT 'OTHER' CHECK (event_type IN (
        'EXAM', 'CAT', 'MARKS_DEADLINE', 'REPORT_RELEASE', 'MEETING', 'HOLIDAY', 'SPORTS', 'OPENING', 'CLOSING', 'OTHER'
    )),
    audience    text NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'STAFF', 'STUDENTS', 'PARENTS')),
    starts_on   date NOT NULL,
    ends_on     date,
    exam_id     uuid REFERENCES public.exams(id) ON DELETE SET NULL,
    description text,
    created_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS school_events_school_date ON public.school_events (school_id, starts_on);
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

-- 2. Exam paper bank -------------------------------------------------------
-- DRAFT -> SUBMITTED -> (RETURNED -> SUBMITTED)* -> APPROVED -> LOCKED -> RELEASED
CREATE TABLE IF NOT EXISTS public.exam_papers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title         text NOT NULL,
    subject_id    uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade_id      uuid REFERENCES public.grades(id) ON DELETE SET NULL,
    exam_id       uuid REFERENCES public.exams(id) ON DELETE SET NULL,
    term_id       uuid REFERENCES public.terms(id) ON DELETE SET NULL,
    paper_label   text,
    status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'LOCKED', 'RELEASED')),
    paper_path    text,
    scheme_path   text,
    copies_needed int NOT NULL DEFAULT 0 CHECK (copies_needed >= 0),
    print_status  text NOT NULL DEFAULT 'PENDING' CHECK (print_status IN ('PENDING', 'PRINTED', 'PACKED')),
    release_at    timestamptz,
    uploaded_by   text REFERENCES public.users(id) ON DELETE SET NULL,
    moderated_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    moderated_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_papers_school_status ON public.exam_papers (school_id, status);
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.exam_paper_reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    paper_id    uuid NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
    reviewer_id text REFERENCES public.users(id) ON DELETE SET NULL,
    action      text NOT NULL CHECK (action IN ('SUBMIT', 'APPROVE', 'RETURN', 'LOCK', 'RELEASE', 'COMMENT')),
    comment     text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_paper_reviews_paper ON public.exam_paper_reviews (paper_id, created_at);
ALTER TABLE public.exam_paper_reviews ENABLE ROW LEVEL SECURITY;

-- Private bucket: papers are only ever served through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-papers', 'exam-papers', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Timetable -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name        text NOT NULL,
    room_type   text NOT NULL DEFAULT 'CLASSROOM' CHECK (room_type IN ('CLASSROOM', 'LAB', 'COMPUTER', 'HALL', 'FIELD', 'OTHER')),
    capacity    int CHECK (capacity IS NULL OR capacity > 0),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- The school day: which weekdays run, and the periods (breaks included).
CREATE TABLE IF NOT EXISTS public.timetable_configs (
    school_id   uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    days        smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
    periods     jsonb NOT NULL DEFAULT '[]'::jsonb,
    rules       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timetable_configs ENABLE ROW LEVEL SECURITY;

-- What must be taught: a subject to a class by a teacher, N lessons a week.
CREATE TABLE IF NOT EXISTS public.timetable_requirements (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    grade_stream_id   uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    subject_id        uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id        text REFERENCES public.users(id) ON DELETE SET NULL,
    lessons_per_week  smallint NOT NULL CHECK (lessons_per_week BETWEEN 1 AND 20),
    double_lessons    smallint NOT NULL DEFAULT 0 CHECK (double_lessons >= 0),
    room_type         text CHECK (room_type IN ('CLASSROOM', 'LAB', 'COMPUTER', 'HALL', 'FIELD', 'OTHER')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK (double_lessons * 2 <= lessons_per_week),
    UNIQUE (school_id, grade_stream_id, subject_id)
);
ALTER TABLE public.timetable_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.timetable_versions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name          text NOT NULL,
    status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    stats         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    published_at  timestamptz
);
-- At most one published timetable per school.
CREATE UNIQUE INDEX IF NOT EXISTS timetable_versions_one_published
    ON public.timetable_versions (school_id) WHERE status = 'PUBLISHED';
ALTER TABLE public.timetable_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.timetable_lessons (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    version_id       uuid NOT NULL REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    requirement_id   uuid REFERENCES public.timetable_requirements(id) ON DELETE SET NULL,
    day              smallint NOT NULL CHECK (day BETWEEN 1 AND 7),
    period           smallint NOT NULL CHECK (period >= 0),
    grade_stream_id  uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    subject_id       uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id       text REFERENCES public.users(id) ON DELETE SET NULL,
    room_id          uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
    locked           boolean NOT NULL DEFAULT false,
    -- A class is never in two places at once within a version.
    UNIQUE (version_id, grade_stream_id, day, period)
);
CREATE INDEX IF NOT EXISTS timetable_lessons_teacher ON public.timetable_lessons (version_id, teacher_id, day, period);
ALTER TABLE public.timetable_lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.timetable_substitutions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    lesson_id          uuid NOT NULL REFERENCES public.timetable_lessons(id) ON DELETE CASCADE,
    cover_date         date NOT NULL,
    absent_teacher_id  text REFERENCES public.users(id) ON DELETE SET NULL,
    cover_teacher_id   text REFERENCES public.users(id) ON DELETE SET NULL,
    reason             text,
    created_by         text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lesson_id, cover_date)
);
ALTER TABLE public.timetable_substitutions ENABLE ROW LEVEL SECURITY;
