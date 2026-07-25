-- Report cards carry a QR code that takes the learner to their own portal.
-- That QR is printed on paper and lives as long as the report card does, so
-- whatever it encodes has to stay valid forever.
--
-- students.id cannot do that job: account activation SWAPS the students row's
-- id from the pending users.id over to the new Clerk user id (see
-- /api/auth/activate). Every QR printed before activation would stop
-- resolving the moment the learner activated. A token that lives in its own
-- column rides along with the row through that update and never changes.
--
-- The token is also a capability — whoever holds the printed report card can
-- claim the account — so it is generated server-side from gen_random_uuid()
-- (122 bits of entropy, hex-encoded, dashes stripped) rather than being
-- derived from anything guessable like an admission number.
ALTER TABLE students ADD COLUMN IF NOT EXISTS portal_token text;

-- Set the default before backfilling so any insert racing this migration
-- still gets a token.
ALTER TABLE students ALTER COLUMN portal_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

UPDATE students
SET portal_token = replace(gen_random_uuid()::text, '-', '')
WHERE portal_token IS NULL;

ALTER TABLE students ALTER COLUMN portal_token SET NOT NULL;

-- Lookups are always "find the student for this token", and the token must be
-- unique for that lookup to be unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS students_portal_token_key ON students (portal_token);
