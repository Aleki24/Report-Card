-- ============================================
-- Fix Supabase Security Linter Warnings (Round 2)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- =============================================
-- 1. FIX: Function Search Path Mutable
--    Set search_path to '' on all affected functions
--    to prevent search_path injection attacks.
-- =============================================

ALTER FUNCTION public.get_my_school_id() SET search_path = '';
ALTER FUNCTION public.get_my_role() SET search_path = '';
ALTER FUNCTION public.calculate_exam_mark_grade() SET search_path = '';
ALTER FUNCTION public.generate_term_reports(uuid, uuid) SET search_path = '';

-- =============================================
-- 2. FIX: RLS Policy Always True
--    The schools_admin_insert policy has WITH CHECK (true)
--    which means ANY user can insert a school.
--    Replace with a proper check that only admins can insert.
-- =============================================

DROP POLICY IF EXISTS schools_admin_insert ON public.schools;
CREATE POLICY schools_admin_insert ON public.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN'
  );

-- =============================================
-- 3. FIX: Anon SECURITY DEFINER Function Executable
--    Revoke EXECUTE from anon role on sensitive functions.
--    These functions should only be callable by authenticated users.
-- =============================================

REVOKE EXECUTE ON FUNCTION public.generate_term_reports(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_school_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;

-- =============================================
-- 4. FIX: Authenticated SECURITY DEFINER Function Executable
--    For rls_auto_enable(), revoke from authenticated too
--    since it's an admin-only utility function.
--    Keep get_my_role and get_my_school_id accessible
--    to authenticated users (they need them for RLS).
--    Keep generate_term_reports for authenticated (teachers use it).
-- =============================================

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
