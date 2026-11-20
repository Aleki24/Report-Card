-- Analytics reads a class as it was in the year being looked at.
--
-- The class rollups joined marks to learners by students.current_grade_stream_id,
-- so after a promotion a past term was read with today's classes: Form 4's
-- 2026 Term 3 held the Form 4s who had just graduated plus last year's Form 3s
-- (promoted into Form 4), each carrying their own 2026 marks.
--
-- A promotion records the class every learner left (student_promotions.from_stream_id),
-- so for a year whose promotion has run (and not been undone) a class's members
-- are read from it; for a year not yet promoted, from learners' classes now, as
-- before. The same rule as src/lib/reports/class-history.ts, for report cards.

create or replace function public.class_roster_in_year(p_school_id uuid, p_year_id uuid)
returns table (student_id text, grade_stream_id uuid)
language sql
stable
set search_path = public, pg_temp
as $$
    with promoted as (
        -- A learner left pending and decided later has a row in each step, both from the same class.
        select distinct on (sp.student_id) sp.student_id, sp.from_stream_id
        from student_promotions sp
        join student_promotion_runs r on r.id = sp.run_id
        where p_year_id is not null
          and r.school_id = p_school_id
          and r.academic_year_id = p_year_id
          and r.undone_at is null
        order by sp.student_id, r.created_at desc
    )
    select p.student_id, p.from_stream_id from promoted p
    union all
    select s.id, s.current_grade_stream_id
    from students s
    join grade_streams gs on gs.id = s.current_grade_stream_id and gs.school_id = p_school_id
    where not exists (select 1 from promoted);
$$;

comment on function public.class_roster_in_year(uuid, uuid) is
    'Each learner''s class in an academic year: from that year''s promotion when it has run, else their class now.';

-- The academic year a term belongs to (null for null).
create or replace function public.term_year(p_term_id uuid)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
    select academic_year_id from terms where id = p_term_id;
$$;

-- One class: series, subjects, merit list.

create or replace function public.class_exam_series(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid default null)
returns table (term_id uuid, term_name text, exam_type text, first_exam_date date, subject_count bigint, mark_count bigint, mean_percentage numeric)
language sql
stable
set search_path = public, pg_temp
as $$
    select e.term_id, t.name, e.exam_type::text, min(e.exam_date),
        count(distinct e.subject_id)::bigint, count(em.id)::bigint,
        round(avg(em.percentage))::numeric
    from exams e
    join exam_marks em on em.exam_id = e.id and em.percentage is not null
    join class_roster_in_year(p_school_id, term_year(p_term_id)) ro
      on ro.student_id = em.student_id and ro.grade_stream_id = p_grade_stream_id
    left join terms t on t.id = e.term_id
    where e.school_id = p_school_id
      and (p_term_id is null or e.term_id = p_term_id)
    group by e.term_id, t.name, e.exam_type
    having count(em.id) > 0;
$$;

create or replace function public.class_subject_performance(
    p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid default null, p_exam_type text default null, p_pass_mark numeric default 50
)
returns table (subject_id uuid, subject_name text, subject_code text, band text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint, highest numeric, lowest numeric)
language sql
stable
set search_path = public, pg_temp
as $$
    select s.id, s.name, s.code, s.band,
        count(distinct em.student_id)::bigint,
        count(em.id)::bigint,
        round(avg(em.percentage))::numeric,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint,
        max(em.percentage)::numeric, min(em.percentage)::numeric
    from exam_marks em
    join exams e on e.id = em.exam_id
    join subjects s on s.id = e.subject_id
    join class_roster_in_year(p_school_id, term_year(p_term_id)) ro
      on ro.student_id = em.student_id and ro.grade_stream_id = p_grade_stream_id
    where e.school_id = p_school_id
      and em.percentage is not null
      and (p_term_id is null or e.term_id = p_term_id)
      and (p_exam_type is null or e.exam_type::text = p_exam_type)
    group by s.id, s.name, s.code, s.band;
$$;

create or replace function public.class_merit_list(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid default null, p_exam_type text default null)
returns table (student_id text, admission_number text, first_name text, last_name text, subjects_sat bigint, mark_count bigint, mean_percentage numeric, papers_available bigint)
language sql
stable
set search_path = public, pg_temp
as $$
    with scoped as (
        select em.id, em.student_id, em.percentage, e.subject_id
        from exam_marks em
        join exams e on e.id = em.exam_id
        join class_roster_in_year(p_school_id, term_year(p_term_id)) ro
          on ro.student_id = em.student_id and ro.grade_stream_id = p_grade_stream_id
        where e.school_id = p_school_id
          and em.percentage is not null
          and (p_term_id is null or e.term_id = p_term_id)
          and (p_exam_type is null or e.exam_type::text = p_exam_type)
    ),
    available as (select count(distinct subject_id)::bigint as n from scoped)
    select sc.student_id, st.admission_number, u.first_name, u.last_name,
        count(distinct sc.subject_id)::bigint, count(sc.id)::bigint,
        round(avg(sc.percentage))::numeric, (select n from available)
    from scoped sc
    join students st on st.id = sc.student_id
    join users u on u.id = st.id
    group by sc.student_id, st.admission_number, u.first_name, u.last_name;
$$;

-- All classes: a term, and a whole year. Every class is listed, with or without marks.

create or replace function public.school_class_performance_for_term(p_school_id uuid, p_term_id uuid, p_pass_mark numeric default 50)
returns table (grade_stream_id uuid, full_name text, level_code text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint)
language sql
stable
set search_path = public, pg_temp
as $$
    with ro as (select * from class_roster_in_year(p_school_id, term_year(p_term_id))),
    marks as (
        select ro.grade_stream_id, em.id, em.percentage
        from ro
        join exam_marks em on em.student_id = ro.student_id and em.percentage is not null
        join exams e on e.id = em.exam_id and e.term_id = p_term_id and e.school_id = p_school_id
    )
    select gs.id, gs.full_name, al.code,
        (select count(distinct r.student_id) from ro r where r.grade_stream_id = gs.id)::bigint,
        count(m.id)::bigint,
        round(avg(m.percentage))::numeric,
        count(m.id) filter (where m.percentage >= p_pass_mark)::bigint
    from grade_streams gs
    left join grades g on g.id = gs.grade_id
    left join academic_levels al on al.id = g.academic_level_id
    left join marks m on m.grade_stream_id = gs.id
    where gs.school_id = p_school_id
    group by gs.id, gs.full_name, al.code;
$$;

create or replace function public.school_class_performance(p_school_id uuid, p_academic_year_id uuid default null, p_pass_mark numeric default 50)
returns table (grade_stream_id uuid, full_name text, level_code text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint)
language sql
stable
set search_path = public, pg_temp
as $$
    with ro as (select * from class_roster_in_year(p_school_id, p_academic_year_id)),
    marks as (
        select ro.grade_stream_id, em.id, em.percentage
        from ro
        join exam_marks em on em.student_id = ro.student_id and em.percentage is not null
        join exams e on e.id = em.exam_id and e.school_id = p_school_id
          and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
    )
    select gs.id, gs.full_name, al.code,
        (select count(distinct r.student_id) from ro r where r.grade_stream_id = gs.id)::bigint,
        count(m.id)::bigint,
        round(avg(m.percentage))::numeric,
        count(m.id) filter (where m.percentage >= p_pass_mark)::bigint
    from grade_streams gs
    left join grades g on g.id = gs.grade_id
    left join academic_levels al on al.id = g.academic_level_id
    left join marks m on m.grade_stream_id = gs.id
    where gs.school_id = p_school_id
    group by gs.id, gs.full_name, al.code;
$$;

-- Only the server calls these (CREATE OR REPLACE keeps the rollups' existing grants).
revoke execute on function public.class_roster_in_year(uuid, uuid) from public, anon, authenticated;
grant execute on function public.class_roster_in_year(uuid, uuid) to service_role;
revoke execute on function public.term_year(uuid) from public, anon, authenticated;
grant execute on function public.term_year(uuid) to service_role;
