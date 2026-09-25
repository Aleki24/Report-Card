-- Term-scoped versions of the school analytics rollups.
--
-- school_class_performance and school_unmarked_exams filter by academic year
-- only, so the Analytics overview could show a whole year but never one term.
-- A school part-way through Term 3 needs to look back at Term 2, and for a
-- while after a term rolls over the previous one holds all the marks.
--
-- New functions rather than an extra parameter on the old ones: adding a
-- defaulted argument would create an ambiguous overload for existing callers
-- (the dashboard calls the year versions by name). Same columns, same rules.

create or replace function public.school_class_performance_for_term(
    p_school_id uuid,
    p_term_id uuid,
    p_pass_mark numeric default 50
)
returns table (
    grade_stream_id uuid,
    full_name text,
    level_code text,
    student_count bigint,
    mark_count bigint,
    mean_percentage numeric,
    pass_count bigint
)
language sql
stable
set search_path = public
as $$
    select
        gs.id as grade_stream_id,
        gs.full_name,
        al.code as level_code,
        count(distinct s.id)::bigint as student_count,
        count(em.id)::bigint as mark_count,
        round(avg(em.percentage))::numeric as mean_percentage,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint as pass_count
    from grade_streams gs
    left join grades g on g.id = gs.grade_id
    left join academic_levels al on al.id = g.academic_level_id
    left join students s on s.current_grade_stream_id = gs.id
    left join exam_marks em on em.student_id = s.id and em.percentage is not null
    left join exams e on e.id = em.exam_id and e.term_id = p_term_id
    where gs.school_id = p_school_id
      -- Drop marks from other terms without dropping classes that have none.
      and (em.id is null or e.id is not null)
    group by gs.id, gs.full_name, al.code;
$$;

comment on function public.school_class_performance_for_term(uuid, uuid, numeric) is
    'Student count, mark count, mean and pass count per class for one school and term. Used by /api/school/analytics/overview.';

create or replace function public.school_unmarked_exams_for_term(
    p_school_id uuid,
    p_term_id uuid
)
returns table (
    label text,
    level_code text,
    unmarked_count bigint
)
language sql
stable
set search_path = public
as $$
    select
        coalesce(gs.full_name, g.name_display, 'Unassigned') as label,
        al.code as level_code,
        count(*)::bigint as unmarked_count
    from exams e
    left join grade_streams gs on gs.id = e.grade_stream_id
    left join grades g on g.id = coalesce(e.grade_id, gs.grade_id)
    left join academic_levels al on al.id = g.academic_level_id
    where e.school_id = p_school_id
      and e.term_id = p_term_id
      and e.exam_date <= current_date
      and not exists (select 1 from exam_marks m where m.exam_id = e.id)
    group by 1, 2;
$$;

comment on function public.school_unmarked_exams_for_term(uuid, uuid) is
    'Exams in one term whose date has passed with no marks recorded, grouped by class. Used by /api/school/analytics/overview.';

revoke execute on function public.school_class_performance_for_term(uuid, uuid, numeric) from public;
grant execute on function public.school_class_performance_for_term(uuid, uuid, numeric) to service_role;
revoke execute on function public.school_unmarked_exams_for_term(uuid, uuid) from public;
grant execute on function public.school_unmarked_exams_for_term(uuid, uuid) to service_role;
