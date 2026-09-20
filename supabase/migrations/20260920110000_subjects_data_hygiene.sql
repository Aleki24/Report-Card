-- Data hygiene before the school_subjects migration.
--
-- Applied to production 2026-09-20. Every statement is guarded and idempotent:
-- on a database where the rows do not exist (a fresh bootstrap, or a re-run)
-- each block finds nothing and does nothing.
--
-- Three things are cleaned up here, all of them consequences of the old
-- onboarding step that wrote subjects from a free-text box:
--
--   1. An abandoned duplicate school whose subjects were written with no owner.
--   2. The 22 ownerless subject rows themselves, visible to every school.
--   3. Two subject rows whose codes did not match the standard catalogue.

-- ── 1. The abandoned duplicate school ────────────────────────────────────
--
-- "Sathya Sai School Kisaju" (b9e20066), created 2026-05-16, never completed
-- onboarding. A second, real school of almost the same name (3ac2c2e3) was
-- created in June and carries all live traffic. The May row held 39 users,
-- 30 students, 156 exams and 72 marks, and was the only user of every
-- ownerless subject row on the instance.
--
-- Matched on BOTH id and name so that an id reused elsewhere cannot make this
-- delete the wrong school.
delete from schools
 where id = 'b9e20066-0fd3-48ec-b731-56f14bb4413e'
   and name = 'Sathya Sai School Kisaju';

-- ── 2. Ownerless subject rows ────────────────────────────────────────────
--
-- `school_id IS NULL` was never a catalogue; it was the absence of an owner.
-- Those rows showed up in every school's subject list. With the school above
-- gone they reference nothing, and the guard proves it rather than assuming
-- it — a row still in use would abort the migration instead of cascading
-- somebody's exams away.
do $$
declare
  v_refs bigint;
  t text;
begin
  foreach t in array array[
    'exams','exam_mark_components','exam_subject_component_schemes','performance_history',
    'report_card_subjects','student_goals','student_subjects',
    'subject_combination_subjects','subject_teacher_assignments'
  ] loop
    -- A table absent on this database is one fewer thing to check, not a failure.
    if to_regclass('public.' || t) is null then continue; end if;

    execute format(
      'select count(*) from %I d join subjects s on s.id = d.subject_id where s.school_id is null', t
    ) into v_refs;

    if v_refs > 0 then
      raise exception
        'ABORT: % still has % rows referencing ownerless subjects; refusing to delete them', t, v_refs;
    end if;
  end loop;

  delete from subjects where school_id is null;
end $$;

-- ── 3. Two mis-coded rows ────────────────────────────────────────────────
--
-- Both were identified from where their MARKS were recorded, not from their
-- names. That distinction matters: the second row below is named
-- "Mathematics", which matches the catalogue's Lower Primary MATH_LP, while
-- every one of its marks is Grade 10 — it is Senior School's Essential
-- Mathematics. Trusting the name would have mis-levelled 70 exams into Lower
-- Primary, which is the class of bug this whole effort exists to remove.
--
-- Changing a code rewrites one row. No exam and no mark moves.
do $$
declare
  live uuid := '3ac2c2e3-938f-48e1-9b45-67f3252c7f40';
  n int;
begin
  -- "Sports and Recreation" was filed under Fine Arts' code, so one school had
  -- two different subjects sharing FA_SS. Left alone, the dedupe step of the
  -- next migration would have merged them and repointed Fine Arts' exams onto
  -- Sports. Its marks are Grade 10; the Senior School code for it is SR_SS.
  update subjects set code = 'SR_SS'
   where school_id = live
     and upper(trim(code)) = 'FA_SS'
     and name = 'Sports and Recreation';

  update subjects set code = 'MATH_ESS_SS', name = 'Essential Mathematics'
   where school_id = live
     and upper(trim(code)) = 'MAT(ESSENTIAL)';

  -- Whatever happened above, no school may be left reusing a code. The next
  -- migration elects one row per code, and that is only safe when a code means
  -- exactly one subject within a school.
  select count(*) into n from (
    select 1 from subjects
     where school_id is not null
     group by school_id, upper(trim(code))
    having count(*) > 1
  ) dupes;

  if n > 0 then
    raise exception 'ABORT: % subject codes are still reused within a single school', n;
  end if;
end $$;
