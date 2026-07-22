-- Add missing columns to subjects table to support multi-tenant schools and categorization
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'TECHNICAL' NOT NULL,
ADD COLUMN IF NOT EXISTS grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL;
