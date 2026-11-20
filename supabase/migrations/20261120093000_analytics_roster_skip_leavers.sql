-- A year not yet promoted is read with learners' classes now, less those who
-- left at an earlier promotion (graduated or transferred): they keep their last
-- class on record but are no longer in it. Without this, 2027 Term 1's Form 4
-- counted the 2026 graduates alongside the class promoted into it.
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
    where not exists (select 1 from promoted)
      and not exists (
          select 1
          from student_promotions sp
          join student_promotion_runs r on r.id = sp.run_id
          where sp.student_id = s.id
            -- This school's promotions only: a learner who transferred in keeps another school's history.
            and r.school_id = p_school_id
            and r.undone_at is null
            and sp.outcome in ('GRADUATE', 'TRANSFER')
      );
$$;
