-- Migration: Add student_goals table for the student portal's self-service
-- study goals ("Study Goals" card — target a score/subject by a deadline).
-- Mirrors daily_attendance's column typing: student_id/created_by are TEXT
-- (Clerk user IDs), not UUID — see fix-users-id-type.sql.

CREATE TABLE IF NOT EXISTS student_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    target_value NUMERIC(5,2),
    deadline DATE,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE student_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view student_goals" ON student_goals
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Students can manage their own goals" ON student_goals
    FOR ALL USING (get_my_role() = 'STUDENT');

CREATE INDEX IF NOT EXISTS idx_student_goals_student ON student_goals(student_id);
