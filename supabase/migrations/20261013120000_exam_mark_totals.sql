-- The dashboard results card downloaded every mark of the term to add them up
-- in the browser: for a large school, tens of thousands of rows, past what a
-- single response may carry. A subject's average needs only each exam's sum
-- and count, so Postgres totals them and the card receives one row per exam.
create or replace function public.exam_mark_totals(
  p_school_id uuid,
  p_term_id uuid default null,
  p_year_id uuid default null,
  p_subject_id uuid default null,
  p_exam_ids uuid[] default null
)
returns table (
  exam_id uuid,
  exam_name text,
  exam_date date,
  subject_id uuid,
  subject_name text,
  mark_count bigint,
  scored_count bigint,
  percentage_sum numeric
)
language sql
stable
set search_path = public
as $$
  select e.id, e.name, e.exam_date, e.subject_id, s.name,
         count(*), count(m.percentage), coalesce(sum(m.percentage), 0)
  from exams e
  join exam_marks m on m.exam_id = e.id
  left join subjects s on s.id = e.subject_id
  where e.school_id = p_school_id
    and (p_term_id is null or e.term_id = p_term_id)
    and (p_year_id is null or e.academic_year_id = p_year_id)
    and (p_subject_id is null or e.subject_id = p_subject_id)
    and (p_exam_ids is null or e.id = any(p_exam_ids))
  group by e.id, e.name, e.exam_date, e.subject_id, s.name
$$;

-- The analytics route calls it with the service role; nobody else may.
revoke execute on function public.exam_mark_totals(uuid, uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.exam_mark_totals(uuid, uuid, uuid, uuid, uuid[]) to service_role;
