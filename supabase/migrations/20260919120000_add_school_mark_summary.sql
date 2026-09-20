-- School-wide mark summary, computed in the database.
--
-- The dashboard needs three numbers over every mark a school has recorded in a
-- year: how many there are, their mean, and how many reach the pass mark. None
-- of them can be had over PostgREST without shipping the rows: aggregate
-- selects are disabled on this project ("PGRST123: Use of aggregate functions
-- is not allowed"), so /api/school/dashboard was fetching raw percentages and
-- capping them at 500. One school already has 1,574 marks in the current year,
-- so its pass rate was being computed from under a third of the data and
-- disagreed with the same figure on the mobile app.
--
-- Doing it here is exact, transfers three numbers instead of thousands of rows,
-- and keeps one definition of "pass" — the caller passes its own pass mark, so
-- the constant still lives in the application.

create or replace function public.school_mark_summary(
    p_school_id uuid,
    p_academic_year_id uuid default null,
    p_pass_mark numeric default 50
)
returns table (
    mark_count bigint,
    mean_percentage numeric,
    pass_count bigint
)
language sql
stable
-- Deliberately SECURITY INVOKER (the default): the row-level policies on
-- exam_marks and exams still apply to whoever calls it. The server calls this
-- with the service role, which bypasses RLS exactly as its direct queries do.
set search_path = public
as $$
    select
        count(*)::bigint as mark_count,
        round(avg(em.percentage))::numeric as mean_percentage,
        count(*) filter (where em.percentage >= p_pass_mark)::bigint as pass_count
    from exam_marks em
    join exams e on e.id = em.exam_id
    where e.school_id = p_school_id
      and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
      and em.percentage is not null;
$$;

comment on function public.school_mark_summary(uuid, uuid, numeric) is
    'Mark count, mean percentage and pass count for one school and academic year. Used by /api/school/dashboard.';

-- Only the server needs this. Postgres grants EXECUTE to PUBLIC on new
-- functions by default, which would expose it to the anon and authenticated
-- roles; take that back and hand it to the service role alone.
revoke execute on function public.school_mark_summary(uuid, uuid, numeric) from public;
grant execute on function public.school_mark_summary(uuid, uuid, numeric) to service_role;
