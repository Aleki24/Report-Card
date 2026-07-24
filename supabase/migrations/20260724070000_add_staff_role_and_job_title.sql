-- Non-teaching staff (Principal, Deputy, Bursar, Secretary, Accountant,
-- Librarian, Nurse, Support Staff, BOM member, …) so a school's full people
-- directory isn't limited to Admins, Class Teachers and Subject Teachers.
--
-- STAFF is a low-privilege login role (no report/marks access by default);
-- job_title carries the specific descriptive role shown in the directory.
--
-- Additive only — existing users keep their role and a NULL job_title.
-- NOTE: ALTER TYPE ... ADD VALUE must run outside a transaction, so it is
-- applied directly (kept here for reference / fresh environments).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STAFF';

ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
