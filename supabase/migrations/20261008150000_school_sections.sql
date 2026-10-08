-- Sections of a school (Primary, Junior School, Senior School), each with its
-- own head who signs its report cards and mark sheets. A school with one
-- admin can have several principals: a class is in the section whose
-- curriculum bands include its grade, and its cards print that section's
-- head (title, name, signature). Classes in no section keep the school-wide
-- principal (schools.principal_name / principal_signature_url).
--
-- bands are curriculum bands (src/lib/curriculum-bands.ts); the API keeps a
-- band in at most one section. Server-only: RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.school_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
    bands text[] NOT NULL DEFAULT '{}' CHECK (bands <@ ARRAY[
        'CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL',
        'CBC_SENIOR_SCHOOL', '844_PRIMARY', '844_SECONDARY'
    ]::text[]),
    head_title text NOT NULL DEFAULT 'Principal' CHECK (length(btrim(head_title)) BETWEEN 1 AND 40),
    head_name text CHECK (head_name IS NULL OR length(head_name) <= 100),
    head_signature text CHECK (head_signature IS NULL OR (head_signature LIKE 'data:image/png;base64,%' AND length(head_signature) <= 400000)),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_sections_school ON public.school_sections(school_id, sort_order);

ALTER TABLE public.school_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_sections FROM anon, authenticated;
