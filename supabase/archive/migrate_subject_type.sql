-- 1. Add the new column
ALTER TABLE subjects ADD COLUMN subject_type TEXT DEFAULT 'CORE';

-- 2. Migrate existing data
UPDATE subjects SET subject_type = 'CORE' WHERE is_compulsory = true;
UPDATE subjects SET subject_type = 'OPTIONAL' WHERE is_compulsory = false;

-- 3. Make the new column NOT NULL
ALTER TABLE subjects ALTER COLUMN subject_type SET NOT NULL;

-- 4. Drop the old column
ALTER TABLE subjects DROP COLUMN is_compulsory;
