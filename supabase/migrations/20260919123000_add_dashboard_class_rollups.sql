-- Per-class rollups for the admin dashboard.
--
-- Both of these were either impossible over PostgREST (aggregates are disabled
-- on this project) or were being done by pulling thousands of id rows into the
-- API route and joining them in JavaScript, because PostgREST has no anti-join.
-- They are small, read-only and grouped, so they belong in the database.

-- ── How each class is doing ──────────────────────────────────────────────
--
-- Marks are attributed through the STUDENT's current class, not the exam's.
-- Many schools enter marks against a whole grade rather than a stream, so the
-- exam's own grade_stream_id is null for a large share of rows; the learner
-- always has a class, so that is the reliable side of the join.
--
-- The curriculum code travels with each row. A CBC Grade 4 and an 8-4-4 Form 4
-- are not graded on the same tables, so the UI labels which is which rather
-- than presenting one ranked list as if they were comparable.
create or replace function public.school_class_performance(
    p_school_id uuid,
    p_academic_year_id uuid default null,
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
    left join exams e
           on e.id = em.exam_id
          and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
    where gs.school_id = p_school_id
      -- Drop marks whose exam fell outside the year filter, without dropping
      -- classes that have no marks at all.
      and (em.id is null or e.id is not null)
    group by gs.id, gs.full_name, al.code;
$$;

comment on function public.school_class_performance(uuid, uuid, numeric) is
    'Student count, mark count, mean and pass count per class for one school and academic year. Used by /api/school/dashboard.';

-- ── Exams sat but never marked, per class ────────────────────────────────
--
-- The single most actionable number this instance has: most exams ever created
-- have no marks against them. `created_by_teacher_id` is null on every one of
-- them here, so the exam cannot be traced to a person — the class is as far as
-- attribution goes, and it is enough to chase.
create or replace function public.school_unmarked_exams(
    p_school_id uuid,
    p_academic_year_id uuid default null
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
      and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
      and e.exam_date <= current_date
      and not exists (select 1 from exam_marks m where m.exam_id = e.id)
    group by 1, 2;
$$;

comment on function public.school_unmarked_exams(uuid, uuid) is
    'Exams whose date has passed with no marks recorded, grouped by class. Used by /api/school/dashboard.';

revoke execute on function public.school_class_performance(uuid, uuid, numeric) from public;
grant execute on function public.school_class_performance(uuid, uuid, numeric) to service_role;

revoke execute on function public.school_unmarked_exams(uuid, uuid) from public;
grant execute on function public.school_unmarked_exams(uuid, uuid) to service_role;
