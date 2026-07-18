-- Migration: Attendance absence notifications (Phase 1 — manual trigger)
-- Run this in the Supabase SQL Editor
--
-- Logs each guardian SMS sent for an absent student so re-triggering
-- "Notify Guardians" for the same date doesn't double-text a guardian
-- who was already notified, and gives admins an audit trail.

CREATE TABLE IF NOT EXISTS attendance_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    channel TEXT NOT NULL DEFAULT 'sms',
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    error TEXT,
    sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE attendance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attendance notifications in their school" ON attendance_notifications
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and class teachers can manage attendance notifications" ON attendance_notifications
    FOR ALL USING (get_my_role() IN ('ADMIN', 'CLASS_TEACHER'));

CREATE INDEX IF NOT EXISTS idx_attendance_notifications_student_date ON attendance_notifications(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_notifications_school_date ON attendance_notifications(school_id, date);
