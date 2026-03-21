-- 1. Create a function to set the app.current_school_id variable
CREATE OR REPLACE FUNCTION auth.set_school_id(school_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_school_id', school_id::text, false);
END;
$$;

-- 2. Define the policy condition macro (a function returning boolean)
CREATE OR REPLACE FUNCTION auth.user_belongs_to_school(target_school_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_school_id UUID;
  session_school_id UUID;
BEGIN
  -- Try to get from custom JWT claim first (if passing via auth payload)
  session_school_id := current_setting('request.jwt.claims', true)::json->>'school_id';
  
  -- If not in JWT, try the manual configuration (for server-side fetches)
  IF session_school_id IS NULL THEN
    BEGIN
      session_school_id := current_setting('app.current_school_id', true);
    EXCEPTION WHEN OTHERS THEN
      session_school_id := NULL;
    END;
  END IF;

  -- Fallback: lookup user's school from the database
  IF session_school_id IS NULL THEN
    SELECT school_id INTO current_user_school_id
    FROM auth.users u
    JOIN public.users pu ON pu.id = u.id
    WHERE u.id = auth.uid();
    
    RETURN target_school_id = current_user_school_id;
  END IF;

  RETURN target_school_id = session_school_id;
END;
$$;

-- Example: Apply to the grades table
DROP POLICY IF EXISTS "Enable all operations for users based on school_id" ON public.grades;

CREATE POLICY "Enable all operations for users based on school_id"
ON public.grades
FOR ALL
USING (auth.user_belongs_to_school(school_id))
WITH CHECK (auth.user_belongs_to_school(school_id));

-- Repeat for ALL OTHER tables (terms, academic_years, subjects, etc.)
-- ...
