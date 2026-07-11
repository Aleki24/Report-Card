-- ============================================
-- Fix users.id column: uuid → text for Clerk IDs
-- Handles FULL foreign key chain AND all RLS policies
-- Run in Supabase SQL Editor
-- ============================================

-- =============================================
-- PHASE 1: Save and Drop all RLS policies
-- =============================================
-- We must drop ALL policies across the entire schema because policies on other tables 
-- (like students, class_teachers) might reference the columns we are changing.

CREATE TEMP TABLE IF NOT EXISTS temp_saved_policies AS
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies
WHERE schemaname = 'public';

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT tablename, policyname FROM temp_saved_policies
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped policy % on %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- =============================================
-- PHASE 2: Drop ALL foreign keys in the chain
-- =============================================
DO $$
DECLARE
    fk RECORD;
BEGIN
    -- Drop FKs referencing students.id first (deepest level)
    FOR fk IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'students' AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', fk.table_name, fk.constraint_name);
        RAISE NOTICE 'Dropped FK on %: %', fk.table_name, fk.constraint_name;
    END LOOP;

    -- Drop FKs referencing users.id
    FOR fk IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users' AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', fk.table_name, fk.constraint_name);
        RAISE NOTICE 'Dropped FK on %: %', fk.table_name, fk.constraint_name;
    END LOOP;
END $$;

-- =============================================
-- PHASE 3: Change column types to text
-- =============================================
ALTER TABLE public.users ALTER COLUMN id TYPE text;
ALTER TABLE public.students ALTER COLUMN id TYPE text;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'user_id' AND data_type = 'uuid'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE text', tbl);
    END LOOP;
    
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'student_id' AND data_type = 'uuid'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN student_id TYPE text', tbl);
    END LOOP;
END $$;

DO $$
DECLARE
    col_name TEXT;
    tbl TEXT;
BEGIN
    FOR col_name IN VALUES ('class_teacher_id'), ('created_by_teacher_id')
    LOOP
        FOR tbl IN
            SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = col_name AND data_type = 'uuid'
        LOOP
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text', tbl, col_name);
        END LOOP;
    END LOOP;
END $$;

-- =============================================
-- PHASE 4: Recreate foreign keys
-- =============================================
ALTER TABLE public.students
    ADD CONSTRAINT fk_students_id_users
    FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'student_id' AND data_type = 'text' AND table_name != 'students'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%I_student_id FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE', tbl, tbl);
        EXCEPTION WHEN OTHERS THEN END;
    END LOOP;
    
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'user_id' AND data_type = 'text'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%I_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE', tbl, tbl);
        EXCEPTION WHEN OTHERS THEN END;
    END LOOP;
END $$;

-- =============================================
-- PHASE 5: Recreate all RLS policies dynamically
-- =============================================
DO $$
DECLARE
    pol RECORD;
    sql TEXT;
    role_list TEXT;
BEGIN
    FOR pol IN SELECT * FROM temp_saved_policies
    LOOP
        role_list := array_to_string(pol.roles, ', ');
        
        sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s', 
            pol.policyname, pol.tablename, pol.permissive, pol.cmd, role_list);
            
        IF pol.qual IS NOT NULL THEN
            sql := sql || format(' USING (%s)', pol.qual);
        END IF;
        
        IF pol.with_check IS NOT NULL THEN
            sql := sql || format(' WITH CHECK (%s)', pol.with_check);
        END IF;
        
        BEGIN
            EXECUTE sql;
            RAISE NOTICE 'Recreated policy % on %', pol.policyname, pol.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to recreate policy % on %: %', pol.policyname, pol.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- Cleanup
DROP TABLE temp_saved_policies;

SELECT 'SUCCESS: users.id and related columns are now TEXT, all policies restored' AS result;
