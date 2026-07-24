-- A school can designate one grading system as "the overall one" — used to
-- compute the aggregate/overall grade from a student's mean marks — while
-- every other grading system stays scoped to whichever subjects it's
-- assigned to.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS overall_grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL;
