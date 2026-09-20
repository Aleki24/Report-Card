-- Per-class analytics, computed in the database.
--
-- The Analytics page pulled every mark in the school to the browser and
-- aggregated there. That is how it came to compute its figures from 1,000 of
-- 1,819 rows (PostgREST's default cap, applied silently), and why it ranked
-- Grade 1 learners against Form 4 candidates: with every mark in one array,
-- nothing in the page distinguished cohorts.
--
-- These do the grouping where the data is, which caps nothing and cannot mix
-- cohorts, because the class is an argument rather than something the caller
-- has to remember to filter by. Same shape as the dashboard rollups added in
-- 20260919123000.
--
-- A note on what "this class" means: many schools enter marks against a whole
-- grade rather than a stream, so an exam's grade_stream_id is null for a large
-- share of rows. The learner always has a class, so attribution runs through
-- students.current_grade_stream_id, exactly as school_class_performance does.

-- ── How each subject is going, within one class ─────────────────────────
--
-- Within a class the curriculum band is fixed, so these rows are comparable
-- with each other — which is precisely what is NOT true of the school-wide
-- subject table this replaces. That one listed "Religious Education" four
-- times (Lower Primary, Upper Primary, Junior, Senior), each a different
-- subject on a different scale, under one name.
create or replace function public.class_subject_performance(
    p_school_id       uuid,
    p_grade_stream_id uuid,
    p_term_id         uuid    default null,
    p_exam_type       text    default null,
    p_pass_mark       numeric default 50
)
returns table (
    subject_id      uuid,
    subject_name    text,
    subject_code    text,
    band            text,
    student_count   bigint,
    mark_count      bigint,
    mean_percentage numeric,
    pass_count      bigint,
    highest         numeric,
    lowest          numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
    select
        s.id   as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        s.band,
        -- Distinct learners, not marks. The page summed mark counts and called
        -- the result "students", which is how 182 learners read as 701.
        count(distinct em.student_id)::bigint as student_count,
        count(em.id)::bigint                  as mark_count,
        round(avg(em.percentage))::numeric    as mean_percentage,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint as pass_count,
        max(em.percentage)::numeric           as highest,
        min(em.percentage)::numeric           as lowest
    from exam_marks em
    join exams e     on e.id = em.exam_id
    join subjects s  on s.id = e.subject_id
    join students st on st.id = em.student_id
    where e.school_id = p_school_id
      and st.current_grade_stream_id = p_grade_stream_id
      and em.percentage is not null
      and (p_term_id   is null or e.term_id = p_term_id)
      and (p_exam_type is null or e.exam_type::text = p_exam_type)
    group by s.id, s.name, s.code, s.band;
$$;

comment on function public.class_subject_performance(uuid, uuid, uuid, text, numeric) is
    'Per-subject mean, pass count and distinct learner count for one class. Used by the Analytics class view.';

-- ── The merit list for one class ────────────────────────────────────────
--
-- Scoped to a class and, normally, to a single exam series (a term plus an
-- exam type — "Term 2 Endterm"), because that is what a merit list is: one
-- cohort that sat the same papers. Pooling terms and exam types ranked a
-- learner with two marks above one with thirteen.
--
-- `papers_available` is how many distinct subjects the class was examined in
-- over that scope. A learner whose subjects_sat falls short of it did not sit
-- the same set as everyone else, and the caller shows them as incomplete
-- rather than letting a high average over two papers take first place.
create or replace function public.class_merit_list(
    p_school_id       uuid,
    p_grade_stream_id uuid,
    p_term_id         uuid default null,
    p_exam_type       text default null
)
returns table (
    -- text, not uuid: learners are keyed by their Clerk id, so students.id and
    -- exam_marks.student_id are both text in this database. (supabase_schema.sql
    -- declares uuid for users/students — drift worth reconciling separately.)
    student_id       text,
    admission_number text,
    first_name       text,
    last_name        text,
    subjects_sat     bigint,
    mark_count       bigint,
    mean_percentage  numeric,
    papers_available bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
    with scoped as (
        select em.id, em.student_id, em.percentage, e.subject_id
        from exam_marks em
        join exams e     on e.id = em.exam_id
        join students st on st.id = em.student_id
        where e.school_id = p_school_id
          and st.current_grade_stream_id = p_grade_stream_id
          and em.percentage is not null
          and (p_term_id   is null or e.term_id = p_term_id)
          and (p_exam_type is null or e.exam_type::text = p_exam_type)
    ),
    available as (
        select count(distinct subject_id)::bigint as n from scoped
    )
    select
        sc.student_id,
        st.admission_number,
        u.first_name,
        u.last_name,
        count(distinct sc.subject_id)::bigint as subjects_sat,
        count(sc.id)::bigint                  as mark_count,
        round(avg(sc.percentage))::numeric    as mean_percentage,
        (select n from available)             as papers_available
    from scoped sc
    join students st on st.id = sc.student_id
    join users u     on u.id  = st.id
    group by sc.student_id, st.admission_number, u.first_name, u.last_name;
$$;

comment on function public.class_merit_list(uuid, uuid, uuid, text) is
    'Per-student mean and subject count for one class and exam series, with the number of papers the class sat so incomplete entries can be marked. Used by the Analytics class view.';

-- ── Which exam series a class actually has ──────────────────────────────
--
-- A series is (term, exam_type) — structural, so no parsing of names like
-- "Term 2 Endterm - English". The page previously bucketed the trend on the
-- raw exam name, which merged distinct exams that happened to share one and
-- split "Mathematics" from "Mathematics " on a trailing space.
create or replace function public.class_exam_series(
    p_school_id       uuid,
    p_grade_stream_id uuid,
    p_term_id         uuid default null
)
returns table (
    term_id         uuid,
    term_name       text,
    exam_type       text,
    first_exam_date date,
    subject_count   bigint,
    mark_count      bigint,
    mean_percentage numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
    select
        e.term_id,
        t.name as term_name,
        e.exam_type::text,
        min(e.exam_date) as first_exam_date,
        count(distinct e.subject_id)::bigint as subject_count,
        count(em.id)::bigint                 as mark_count,
        round(avg(em.percentage))::numeric   as mean_percentage
    from exams e
    join exam_marks em on em.exam_id = e.id and em.percentage is not null
    join students st   on st.id = em.student_id
    left join terms t  on t.id = e.term_id
    where e.school_id = p_school_id
      and st.current_grade_stream_id = p_grade_stream_id
      and (p_term_id is null or e.term_id = p_term_id)
    group by e.term_id, t.name, e.exam_type
    having count(em.id) > 0;
$$;

comment on function public.class_exam_series(uuid, uuid, uuid) is
    'The exam series a class has marks for, identified by term and exam type rather than by exam name. Used by the Analytics class view.';

-- Only the server calls these. Postgres grants EXECUTE to PUBLIC on new
-- functions by default, which would expose them to anon and authenticated.
revoke execute on function public.class_subject_performance(uuid, uuid, uuid, text, numeric) from public;
grant  execute on function public.class_subject_performance(uuid, uuid, uuid, text, numeric) to service_role;

revoke execute on function public.class_merit_list(uuid, uuid, uuid, text) from public;
grant  execute on function public.class_merit_list(uuid, uuid, uuid, text) to service_role;

revoke execute on function public.class_exam_series(uuid, uuid, uuid) from public;
grant  execute on function public.class_exam_series(uuid, uuid, uuid) to service_role;
