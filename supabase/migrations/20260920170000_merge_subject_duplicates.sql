-- Collapse duplicate subject rows onto one catalogue row, and retire the
-- legacy ownership columns.
--
-- Final step of the catalogue split. Two schools each held their own copy of
-- "Mathematics (MATH_JS)" with different ids; from here there is one row and
-- two `school_subjects` entries pointing at it.
--
-- This runs AFTER the application reads ownership from `school_subjects`
-- (see the previous migration and the cutover it describes). The order is not
-- cosmetic: a merged row can name only one owner, so merging while the app
-- still read `subjects.school_id` would have emptied the losing school's
-- subject list — and every one of the second school's nine subjects is a merge
-- candidate, so it would have lost all of them.
--
-- Rehearsed end to end on a copy of production before being applied: 63
-- subjects to 54, offerings unchanged at 63, exams and marks unchanged, and no
-- orphaned subject_id in any of the nine dependent tables.

-- ── An audit trail, so this is reversible ────────────────────────────────
--
-- The merge rewrites subject_id on real exam rows — the first thing in this
-- whole sequence to do so. Every rewrite is recorded here first, which makes
-- the merge undoable by replaying the table backwards. It is small and it
-- stays.
create table if not exists public.subjects_merge_audit (
    id           bigserial primary key,
    merged_at    timestamptz not null default now(),
    code         text        not null,
    loser_id     uuid        not null,
    winner_id    uuid        not null,
    table_name   text        not null,
    row_id       text,
    loser_name   text,
    loser_school uuid
);

comment on table public.subjects_merge_audit is
    'Every subject_id rewritten when duplicate subject rows were merged onto one catalogue row. Kept so the merge can be replayed backwards.';

-- Deliberately RLS-enabled with no policy: that denies every role except the
-- service role, which is the correct posture for an audit table nobody should
-- read from the client. Supabase's advisor reports it as INFO; it is intended.
alter table public.subjects_merge_audit enable row level security;

do $$
declare
  r        record;
  winner   uuid;
  t        text;
  n_merged int := 0;
begin
  for r in
    select upper(trim(code)) as code
      from public.subjects
     group by upper(trim(code))
    having count(*) > 1
  loop
    -- The row carrying the most history wins and keeps its id, so the school
    -- with the real data never has its exams repointed at all.
    select s.id into winner
      from public.subjects s
     where upper(trim(s.code)) = r.code
     order by (
       (select count(*) from public.exams e where e.subject_id = s.id) +
       (select count(*) from public.subject_teacher_assignments a where a.subject_id = s.id) +
       (select count(*) from public.exam_mark_components c where c.subject_id = s.id)
     ) desc, s.created_at asc
     limit 1;

    -- Record the losers themselves before anything moves.
    insert into public.subjects_merge_audit (code, loser_id, winner_id, table_name, loser_name, loser_school)
    select r.code, s.id, winner, 'subjects', s.name, s.school_id
      from public.subjects s
     where upper(trim(s.code)) = r.code and s.id <> winner;

    foreach t in array array[
      'exams','exam_mark_components','exam_subject_component_schemes','performance_history',
      'report_card_subjects','student_goals','student_subjects',
      'subject_combination_subjects','subject_teacher_assignments'
    ] loop
      if to_regclass('public.' || t) is null then continue; end if;

      -- Log which rows are about to move, then move them.
      execute format($f$
        insert into public.subjects_merge_audit (code, loser_id, winner_id, table_name, row_id)
        select %L, d.subject_id, %L, %L, d.id::text
          from public.%I d
         where d.subject_id in (
           select id from public.subjects where upper(trim(code)) = %L and id <> %L)
      $f$, r.code, winner, t, t, r.code, winner);

      execute format($f$
        update public.%I d set subject_id = %L
         where d.subject_id in (
           select id from public.subjects where upper(trim(code)) = %L and id <> %L)
      $f$, t, winner, r.code, winner);
    end loop;

    -- A school that offered a losing row now offers the winner. ON CONFLICT
    -- covers a school that somehow held both copies.
    execute format($f$
      insert into public.school_subjects (school_id, subject_id, grading_system_id, created_at)
      select ss.school_id, %L, ss.grading_system_id, ss.created_at
        from public.school_subjects ss
       where ss.subject_id in (
         select id from public.subjects where upper(trim(code)) = %L and id <> %L)
      on conflict (school_id, subject_id) do nothing
    $f$, winner, r.code, winner);

    delete from public.school_subjects
     where subject_id in (
       select id from public.subjects where upper(trim(code)) = r.code and id <> winner);

    delete from public.subjects
     where upper(trim(code)) = r.code and id <> winner;

    n_merged := n_merged + 1;
  end loop;

  raise notice 'Merged % duplicate codes', n_merged;
end $$;

-- ── Nothing may be left pointing at a row that no longer exists ──────────
do $$
declare v_bad bigint; t text;
begin
  foreach t in array array[
    'exams','exam_mark_components','exam_subject_component_schemes','performance_history',
    'report_card_subjects','student_goals','student_subjects',
    'subject_combination_subjects','subject_teacher_assignments','school_subjects'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format(
      'select count(*) from %I d left join subjects s on s.id = d.subject_id
        where s.id is null and d.subject_id is not null', t
    ) into v_bad;
    if v_bad > 0 then
      raise exception 'ABORT: % has % rows pointing at a merged-away subject', t, v_bad;
    end if;
  end loop;

  select count(*) into v_bad from (
    select 1 from public.subjects group by upper(trim(code)) having count(*) > 1
  ) dupes;
  if v_bad > 0 then
    raise exception 'ABORT: % duplicate codes survived the merge', v_bad;
  end if;
end $$;

-- ── Retire the legacy ownership columns ──────────────────────────────────
--
-- Ownership is `school_subjects` now and the grading system is a property of
-- the offering. Dropping rather than leaving them behind is deliberate: a
-- stale school_id on a shared row is worse than no column, because a missed
-- read would return a plausible wrong answer instead of failing loudly.
--
-- school_subject_catalogue selects neither column, so it is unaffected.
alter table public.subjects drop column if exists school_id;
alter table public.subjects drop column if exists grading_system_id;

-- ── Stop duplicates coming back ──────────────────────────────────────────
--
-- The merge collapsed every duplicate code, but nothing prevented the next
-- one. A code now names one standard subject; a subject a school invented for
-- itself is unique only within that school, since two schools may
-- independently coin the same code for different things. Partial indexes
-- rather than a plain UNIQUE, because those two rules differ.
create unique index if not exists subjects_standard_code_key
    on public.subjects (upper(trim(code))) where origin_school_id is null;

create unique index if not exists subjects_custom_code_key
    on public.subjects (origin_school_id, upper(trim(code))) where origin_school_id is not null;
