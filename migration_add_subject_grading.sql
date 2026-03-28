-- Add grading_system_id to subjects table to allow per-subject grading
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subjects_grading_system ON subjects(grading_system_id);
