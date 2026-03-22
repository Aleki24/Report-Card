-- We want subjects isolating per school_id or being globally available (school_id is null)
-- So the global uniqueness on code must be scoped to school_id instead. nulls are distinct in postgres

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_code_key;

-- We ensure school_id exists on subjects (though backfill might have added it already)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Scope uniqueness of subject code to school_id
ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_code_key UNIQUE (school_id, code);

-- Verify policies are multi-tenant (if RLS is enabled)
DROP POLICY IF EXISTS "Public read subjects" ON subjects;
DROP POLICY IF EXISTS "Users can read subjects" ON subjects;

-- Assuming get_my_role() is working or they can just read their own school's / global subjects
CREATE POLICY "Users can read subjects" ON subjects FOR SELECT USING (
    school_id IS NULL OR 
    school_id = (SELECT s.school_id FROM users s WHERE s.id = auth.uid() LIMIT 1)
);
