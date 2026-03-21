-- First, identify the default school ID
DO $$
DECLARE
  default_school_id UUID;
BEGIN
  -- Change this to your actual default school ID, or select the first one
  SELECT id INTO default_school_id FROM public.schools LIMIT 1;
  
  IF default_school_id IS NULL THEN
    RAISE EXCEPTION 'No school found in the database. Create a school first.';
  END IF;

  -- 1. Update all users to belong to this school (if they don't already)
  UPDATE public.users 
  SET school_id = default_school_id 
  WHERE school_id IS NULL;

  -- 2. Update all academic structure tables
  UPDATE public.academic_years SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.terms SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.academic_levels SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grades SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grade_streams SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.subjects SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grading_systems SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.grading_scales SET school_id = default_school_id WHERE school_id IS NULL;

  -- 3. Update all student and enrollment tables
  UPDATE public.students SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.student_enrollments SET school_id = default_school_id WHERE school_id IS NULL;

  -- 4. Update all exam and result tables
  UPDATE public.exams SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.exam_marks SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE public.exam_results SET school_id = default_school_id WHERE school_id IS NULL;

  RAISE NOTICE 'Backfilled school_id % for all existing records.', default_school_id;
END $$;
