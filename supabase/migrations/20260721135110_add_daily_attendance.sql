-- Migration: Create daily_attendance table for school-scoped attendance tracking
-- Run this in the Supabase SQL Editor

-- Create attendance status enum
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create daily_attendance table
CREATE TABLE IF NOT EXISTS daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status NOT NULL DEFAULT 'present',
    marked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, date) -- One record per student per day
);

-- Enable RLS
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view attendance in their school" ON daily_attendance
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Teachers and admins can manage attendance" ON daily_attendance
    FOR ALL USING (
        get_my_role() IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER')
    );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_daily_attendance_school_date ON daily_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_student_date ON daily_attendance(student_id, date);
