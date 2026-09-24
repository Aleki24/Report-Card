-- How report cards position learners.
--
-- cbc_ranking_enabled: KNEC does not rank KPSEA/KJSEA candidates or schools,
-- and competency-based assessment reports performance levels rather than
-- positions. So CBC report cards print no positions unless the school opts
-- in. 8-4-4 cards always rank.
--
-- senior_rank_group: when CBC ranking is on, who a Senior School (Grades
-- 10-12) learner's overall position is counted against — the whole grade,
-- everyone in the same pathway (STEM / Social Sciences / Arts & Sports), or
-- everyone in the same subject combination. Every stream of the grade is
-- pooled in each case.
alter table public.schools
  add column if not exists cbc_ranking_enabled boolean not null default false,
  add column if not exists senior_rank_group text not null default 'GRADE';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schools_senior_rank_group_check') then
    alter table public.schools
      add constraint schools_senior_rank_group_check
      check (senior_rank_group in ('GRADE', 'PATHWAY', 'COMBINATION'));
  end if;
end $$;

comment on column public.schools.cbc_ranking_enabled is
  'Print positions on CBC report cards. Off by default, following KNEC''s no-ranking policy for competency-based assessment.';
comment on column public.schools.senior_rank_group is
  'CBC Senior School overall-position pool: GRADE (all learners), PATHWAY, or COMBINATION — across every stream.';
