-- Fix the RLS identity helpers, and close direct table access that fixing
-- them would otherwise open.
--
-- 1. get_my_role() / get_my_school_id() compared users.id (text: Clerk ids
--    like "user_2abc…") with auth.uid() (uuid). Postgres has no text = uuid
--    operator, so every policy that called them raised an error for any
--    caller that was not service_role. Compare with the token's text "sub"
--    instead: an unknown or missing caller now gets NULL (no match), never an
--    error.
--
-- 2. That error was the only thing stopping the many
--    "auth.role() = 'authenticated'" policies (students, users, exams, fees,
--    schools, …) from letting ANY signed-in Supabase account read every
--    school's rows — schools was already readable that way, invite codes and
--    approval tokens included, because its only SELECT policy has no helper
--    call to fail. The app never queries tables as anon or authenticated:
--    every route uses the service-role client, which bypasses RLS and these
--    grants. So revoke direct table access from both roles, for existing
--    and future tables, rather than leave cross-tenant policies one fix away
--    from exposing data. Photos are served from public storage URLs, which
--    are governed by storage policies, not these grants.

create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
    select role from public.users where id = (auth.jwt() ->> 'sub') limit 1;
$$;

create or replace function public.get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select school_id from public.users where id = (auth.jwt() ->> 'sub') limit 1;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- With no table access left for anon and authenticated, nothing evaluates the
-- helpers as those roles; stop exposing them (and the rls_auto_enable
-- event-trigger function) as /rest/v1/rpc endpoints.
revoke execute on function public.get_my_role() from public, anon, authenticated;
revoke execute on function public.get_my_school_id() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
