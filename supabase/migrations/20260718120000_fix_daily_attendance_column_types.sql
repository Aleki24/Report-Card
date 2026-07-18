-- Migration: Fix daily_attendance.student_id and marked_by column types
-- Run this in the Supabase SQL Editor
--
-- users.id and students.id were migrated from uuid to text to hold Clerk IDs
-- (see supabase/archive/fix-users-id-type.sql), but daily_attendance was added
-- afterwards and still declared student_id/marked_by as uuid, causing
-- "invalid input syntax for type uuid" errors when saving attendance.

ALTER TABLE public.daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_student_id_fkey;
ALTER TABLE public.daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_marked_by_fkey;

ALTER TABLE public.daily_attendance ALTER COLUMN student_id TYPE text USING student_id::text;
ALTER TABLE public.daily_attendance ALTER COLUMN marked_by TYPE text USING marked_by::text;

ALTER TABLE public.daily_attendance
    ADD CONSTRAINT daily_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.daily_attendance
    ADD CONSTRAINT daily_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id) ON DELETE SET NULL;
