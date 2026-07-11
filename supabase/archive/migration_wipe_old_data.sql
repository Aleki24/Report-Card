-- migration_wipe_old_data.sql
-- WARNING: This script completely clears ALL data from your database (Users, Schools, Students, Streams, Exams, etc.)
-- EXCEPT for the standard Academic Levels and Grades mapping (which are usually static curriculum data).
-- Use this ONLY if you want a 100% fresh start to safely test the multi-tenant system with zero old data.

-- 1. Delete all users from the Supabase Auth system. 
-- This will automatically CASCADE and delete everything in public.users, public.students, teachers, etc.
DELETE FROM auth.users;

-- 2. Truncate all custom configuration tables.
-- The CASCADE keyword ensures any dependent records (like exams, marks, assignments) that somehow survived 
-- are also cleanly wiped out.
TRUNCATE TABLE 
  public.schools,
  public.grade_streams,
  public.academic_years,
  public.terms,
  public.subjects,
  public.pending_invites
CASCADE;

-- Note: We are NOT truncating public.academic_levels or public.grades, 
-- because those are usually standard curriculum structures that take time to set up.
-- If you DO want to wipe those as well, you can run: TRUNCATE TABLE public.academic_levels CASCADE;
