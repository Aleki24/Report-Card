-- Migration: Restore missing foreign keys on student_fees
--
-- /api/school/fees always embeds terms(id, name) in its select, but
-- student_fees.term_id (and school_id) had no foreign key to terms/schools
-- — likely dropped by fix-users-id-type.sql's FK-drop-and-selectively-
-- recreate sweep and never restored for these columns. Without the FK,
-- PostgREST can't resolve the embed and every /api/school/fees call 400s
-- ("Could not find a relationship between student_fees and terms"),
-- confirmed live in production. Affects the admin fees dashboard and the
-- student fees page/dashboard tile alike.
--
-- Already applied directly to production (student_fees had 0 rows at the
-- time, so this is a safe no-op for any existing data); this file just
-- brings the migration history in sync and covers fresh installs.

ALTER TABLE public.student_fees
  ADD CONSTRAINT student_fees_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

ALTER TABLE public.student_fees
  ADD CONSTRAINT student_fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
