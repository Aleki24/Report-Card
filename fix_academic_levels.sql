-- Drop unique constraints on subject code and name so the same subject
-- can exist in different CBC stages (e.g., "RE" in Junior School and
-- "RE" in Senior School). The application handles duplicate prevention.

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_level_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_level_name_key;
