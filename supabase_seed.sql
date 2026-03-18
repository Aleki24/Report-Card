-- resultsapp_seed.sql
-- This script safely populates your Supabase database with dummy testing data
-- Run this in the Supabase SQL Editor to get dummy users for the different roles.

-- 1. Create Academic Levels
INSERT INTO public.academic_levels (code, name, description)
VALUES 
  ('844', '8-4-4 System', 'The Kenyan 8-4-4 education system'),
  ('CBC', 'Competency Based Curriculum', 'The new Kenyan CBC system')
ON CONFLICT (code) DO NOTHING;

-- 2. Create Grades
DO $$
DECLARE
  v_844_id UUID;
  v_cbc_id UUID;
BEGIN
  SELECT id INTO v_844_id FROM public.academic_levels WHERE code = '844';
  SELECT id INTO v_cbc_id FROM public.academic_levels WHERE code = 'CBC';

  INSERT INTO public.grades (academic_level_id, code, name_display, numeric_order, is_exam_class) VALUES
    (v_cbc_id, 'G7', 'Grade 7', 7, false),
    (v_cbc_id, 'G8', 'Grade 8', 8, false),
    (v_844_id, 'F1', 'Form 1', 9, false),
    (v_844_id, 'F2', 'Form 2', 10, false),
    (v_844_id, 'F3', 'Form 3', 11, false),
    (v_844_id, 'F4', 'Form 4', 12, true)
  ON CONFLICT DO NOTHING;
END $$;

-- 3. Create Grade Streams (Classes)
DO $$
DECLARE
  v_f1_id UUID;
  v_f2_id UUID;
BEGIN
  SELECT id INTO v_f1_id FROM public.grades WHERE code = 'F1';
  SELECT id INTO v_f2_id FROM public.grades WHERE code = 'F2';

  IF v_f1_id IS NOT NULL THEN
    INSERT INTO public.grade_streams (grade_id, name, full_name) VALUES
      (v_f1_id, 'A', 'Form 1A'),
      (v_f1_id, 'B', 'Form 1B')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_f2_id IS NOT NULL THEN
    INSERT INTO public.grade_streams (grade_id, name, full_name) VALUES
      (v_f2_id, 'A', 'Form 2A')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4. Create Subjects
DO $$
DECLARE
  v_844_id UUID;
BEGIN
  SELECT id INTO v_844_id FROM public.academic_levels WHERE code = '844';

  IF v_844_id IS NOT NULL THEN
    INSERT INTO public.subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
      ('MAT', 'Mathematics', v_844_id, true, 1),
      ('ENG', 'English', v_844_id, true, 2),
      ('KIS', 'Kiswahili', v_844_id, true, 3),
      ('CHE', 'Chemistry', v_844_id, false, 4),
      ('PHY', 'Physics', v_844_id, false, 5)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- 5. Create Academic Years & Terms
INSERT INTO public.academic_years (name, start_date, end_date) 
VALUES ('2026', '2026-01-05', '2026-11-20')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE 
  v_year_id UUID;
BEGIN
  SELECT id INTO v_year_id FROM public.academic_years WHERE name = '2026';
  IF v_year_id IS NOT NULL THEN
    INSERT INTO public.terms (academic_year_id, name, start_date, end_date, is_current) VALUES
      (v_year_id, 'Term 1', '2026-01-05', '2026-04-09', false),
      (v_year_id, 'Term 2', '2026-04-27', '2026-08-07', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Note on Users:
-- Creating users purely via SQL requires inserting into `auth.users` directly, 
-- which can be messy with encrypted passwords and identities.
-- Instead, the easiest way to test the roles is to open your app and:
-- 1. Sign up 3 accounts (e.g. admin@test.com, teacher@test.com, student@test.com)
-- 2. Then run THIS query to assign them their roles:
--
-- UPDATE public.users SET role = 'ADMIN' WHERE email = 'admin@test.com';
-- UPDATE public.users SET role = 'CLASS_TEACHER' WHERE email = 'teacher@test.com';
-- UPDATE public.users SET role = 'STUDENT' WHERE email = 'student@test.com';
