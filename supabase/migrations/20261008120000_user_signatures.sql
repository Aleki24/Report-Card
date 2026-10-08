-- Staff signatures for report cards and mark sheets. A class teacher's (or
-- any staff member's) signature is photographed once and printed on every
-- card instead of being signed by hand. The principal's stays on schools.
--
-- Stored as a small transparent PNG data URL (the server cleans the photo
-- first), like schools.principal_signature_url, so the PDF renderers can
-- print it without a storage round trip. Kept out of users so the many
-- queries reading users do not carry image data. Server-only: RLS on, no
-- policies; the API checks who may read or change each signature.
CREATE TABLE IF NOT EXISTS public.user_signatures (
    user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    image text NOT NULL CHECK (image LIKE 'data:image/png;base64,%' AND length(image) <= 400000),
    updated_by text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_signatures_school ON public.user_signatures(school_id);

ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_signatures FROM anon, authenticated;
