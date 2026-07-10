-- Add new standard Exam Types to the exam_type ENUM
-- Note: PostgreSQL does not support "IF NOT EXISTS" for ALTER TYPE ADD VALUE directly in older versions, 
-- but in newer versions it does. Supabase uses PG15+ which supports it.

ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'CAT';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'TOPICAL';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'ZONE';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'SUB_COUNTY';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'COUNTY';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'REGIONAL';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'PRE_MOCK';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'MOCK';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'POST_MOCK';
ALTER TYPE exam_type ADD VALUE IF NOT EXISTS 'NATIONAL';

-- Also adding the previous schema fixes just in case they haven't been run yet:
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL;
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS rubric JSONB;
