-- Fix global unique constraints that prevent multi-tenant isolation

-- 1. Ensure school_id exists on key tables
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE grade_streams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 2. Academic Years: Scope name uniqueness to the school
ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS academic_years_name_key;
ALTER TABLE academic_years DROP CONSTRAINT IF EXISTS academic_years_school_id_name_key;
ALTER TABLE academic_years ADD CONSTRAINT academic_years_school_id_name_key UNIQUE (school_id, name);

-- 3. Grade Streams: Scope uniqueness to the school and grade
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_grade_id_name_key;
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_school_id_grade_id_name_key;
ALTER TABLE grade_streams ADD CONSTRAINT grade_streams_school_id_grade_id_name_key UNIQUE (school_id, grade_id, name);

-- 4. Students: Remove global unique constraint on admission_number
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_admission_number_key;
