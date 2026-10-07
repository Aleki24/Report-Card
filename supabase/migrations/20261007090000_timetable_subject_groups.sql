-- Subjects a school teaches at the same time (an option group): learners
-- take one of them, so the timetable runs them in one slot. Scoped to
-- curriculum levels; an empty list means every level.
CREATE TABLE IF NOT EXISTS public.timetable_subject_groups (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    bands        text[] NOT NULL DEFAULT '{}',
    subject_ids  uuid[] NOT NULL CHECK (cardinality(subject_ids) >= 2),
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS timetable_subject_groups_school_idx ON public.timetable_subject_groups (school_id);
ALTER TABLE public.timetable_subject_groups ENABLE ROW LEVEL SECURITY;
