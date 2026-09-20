-- Pin search_path on every function that did not set one.
--
-- A function with a mutable search_path resolves unqualified names against
-- whatever the CALLER's search_path happens to be. For a SECURITY DEFINER
-- function that means someone can create a table or function of the same name
-- in a schema earlier in their own path and have the definer's privileges
-- applied to it. Supabase's security advisor flagged all eleven of these.
--
-- pg_temp is listed LAST on purpose. Leave it out and PostgreSQL still searches
-- the temporary schema — implicitly, and FIRST — so a temp table can shadow a
-- real one. Naming it last is what actually closes that door; it is the
-- arrangement the PostgreSQL manual recommends for SECURITY DEFINER functions.
--
-- `public` rather than `''` because these bodies reference public tables
-- unqualified. Moving to '' would mean rewriting every statement to be fully
-- qualified: a larger change with more ways to go wrong, for no additional
-- protection here. The two functions that reach outside public already write
-- auth.uid() in full, and none of the eleven touches vault, pg_net or an
-- extensions schema — checked before this was applied.

-- SECURITY DEFINER — the ones that actually carry elevated privilege.
alter function public.generate_term_reports(p_academic_year_id uuid, p_term_id uuid, p_grade_stream_id uuid)
    set search_path = public, pg_temp;
alter function public.get_my_role()
    set search_path = public, pg_temp;

-- Trigger functions. SECURITY INVOKER, so not privilege escalation, but they
-- run on every write to marks, students, fees and enrollments and should
-- resolve names predictably rather than depending on the session.
alter function public.calculate_exam_mark_grade()   set search_path = public, pg_temp;
alter function public.set_student_school_id()       set search_path = public, pg_temp;
alter function public.sync_student_school_id()      set search_path = public, pg_temp;
alter function public.sync_student_fee_totals()     set search_path = public, pg_temp;
alter function public.touch_exam_mark_component()   set search_path = public, pg_temp;
alter function public.touch_student_subject()       set search_path = public, pg_temp;
alter function public.touch_subject_combination()   set search_path = public, pg_temp;

-- Helpers.
alter function public.generate_receipt_number()      set search_path = public, pg_temp;
alter function public.generate_school_invite_codes() set search_path = public, pg_temp;

-- Nothing in public may be left unpinned.
do $$
declare v_unpinned int;
begin
  select count(*) into v_unpinned
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
   where n.nspname = 'public' and l.lanname in ('plpgsql','sql') and p.proconfig is null;
  if v_unpinned > 0 then
    raise exception 'ABORT: % functions still have a mutable search_path', v_unpinned;
  end if;
end $$;
