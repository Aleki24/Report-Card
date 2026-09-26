-- Report-card details a school sets in Settings, and its own pass mark.
-- All additive: existing schools keep printing as before and pass at 50%.
ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS motto text,
    ADD COLUMN IF NOT EXISTS principal_name text,
    ADD COLUMN IF NOT EXISTS principal_signature_url text,
    ADD COLUMN IF NOT EXISTS pass_mark numeric NOT NULL DEFAULT 50;

ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_pass_mark_range;
ALTER TABLE public.schools
    ADD CONSTRAINT schools_pass_mark_range CHECK (pass_mark >= 1 AND pass_mark <= 100);
