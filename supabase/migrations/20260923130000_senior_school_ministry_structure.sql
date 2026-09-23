-- Bring Senior School (Grades 10-12) in line with the Ministry of Education's
-- current structure (Grade 10 selection documents, KEMIS, 11 Aug 2026), and
-- re-sync existing learners' enrolments to it.
--
-- What changed in the rules:
--   * Compulsory subjects are English, Kiswahili, Community Service Learning
--     and Mathematics. Physical Education and ICT Skills are no longer
--     compulsory. Core Mathematics is one of the three electives of a
--     combination; a learner without it takes Essential Mathematics.
--   * Kenya Sign Language is an elective (and the alternative to Kiswahili
--     for learners who need it) — it must never be enrolled automatically.
--   * Seven tracks: Pure Sciences, Applied Sciences, Technical Studies;
--     Languages & Literature, Humanities & Business Studies; Arts, Sports.
--
-- Nothing here touches exams or marks. Subject CODES are never changed, only
-- display names, so every recorded exam keeps pointing at the same subject.
-- The application-side rule lives in seniorCoreCodes() in
-- src/lib/pathway-definitions.ts; section 4 applies that same rule once to
-- learners enrolled under the old one.

-- ── 1. Official subject names (catalogue rows only) ──────────────────────
update public.subjects set name = 'Core Mathematics'
 where upper(trim(code)) = 'MATH_SS' and origin_school_id is null;
update public.subjects set name = 'Computer Studies'
 where upper(trim(code)) = 'COMP_SS' and origin_school_id is null;
update public.subjects set name = 'Fasihi ya Kiswahili'
 where upper(trim(code)) = 'KK_SS' and origin_school_id is null;
update public.subjects set name = 'Indigenous Language'
 where upper(trim(code)) = 'IND_SS' and origin_school_id is null;

-- ── 2. No longer compulsory ──────────────────────────────────────────────
-- subject_type decides CORE vs ELECTIVE when a subject is enrolled by hand
-- (api/admin/student-subjects), so it has to follow the rule too.
update public.subjects set subject_type = 'OPTIONAL'
 where upper(trim(code)) in ('PE_SS', 'ICT_SS', 'KSL_SS')
   and subject_type = 'CORE';

-- ── 3. Stored track names → the official seven ───────────────────────────
update public.subject_combinations set track = case track
    when 'Technology & Engineering'   then 'Technical Studies'
    when 'Career & Technical Studies' then 'Technical Studies'
    when 'Performing Arts'            then 'Arts'
    when 'Visual Arts'                then 'Arts'
    when 'Sports Science'             then 'Sports'
    else track end
 where track in ('Technology & Engineering', 'Career & Technical Studies',
                 'Performing Arts', 'Visual Arts', 'Sports Science');

update public.students set track = case track
    when 'Technology & Engineering'   then 'Technical Studies'
    when 'Career & Technical Studies' then 'Technical Studies'
    when 'Performing Arts'            then 'Arts'
    when 'Visual Arts'                then 'Arts'
    when 'Sports Science'             then 'Sports'
    else track end
 where track in ('Technology & Engineering', 'Career & Technical Studies',
                 'Performing Arts', 'Visual Arts', 'Sports Science');

-- ── 4. Re-sync learners already assigned to a combination ────────────────

-- 4a. Drop the automatic enrolments the old rule made. Only rows with role
-- CORE: if KSL is one of a learner's combination electives, its row carries
-- role ELECTIVE and stays.
delete from public.student_subjects ss
 using public.subjects s, public.students st
 where ss.subject_id = s.id
   and ss.student_id = st.id
   and st.subject_combination_id is not null
   and ss.role = 'CORE'
   and upper(trim(s.code)) in ('PE_SS', 'ICT_SS', 'KSL_SS');

-- 4b. Learners whose combination includes Core Mathematics do not also take
-- Essential Mathematics.
delete from public.student_subjects ss
 using public.subjects s, public.students st
 where ss.subject_id = s.id
   and ss.student_id = st.id
   and upper(trim(s.code)) = 'MATH_ESS_SS'
   and ss.role = 'CORE'
   and exists (
       select 1
         from public.subject_combination_subjects scs
         join public.subjects cs on cs.id = scs.subject_id
        where scs.combination_id = st.subject_combination_id
          and upper(trim(cs.code)) = 'MATH_SS'
   );

-- 4c. Everyone else takes Essential Mathematics, where their school offers
-- it. The old rule never enrolled it, so these learners had no mathematics.
insert into public.student_subjects (student_id, subject_id, role, school_id)
select st.id, ess.id, 'CORE', sc.school_id
  from public.students st
  join public.subject_combinations sc on sc.id = st.subject_combination_id
  join public.school_subjects offer on offer.school_id = sc.school_id
  join public.subjects ess on ess.id = offer.subject_id
                          and upper(trim(ess.code)) = 'MATH_ESS_SS'
 where not exists (
       select 1
         from public.subject_combination_subjects scs
         join public.subjects cs on cs.id = scs.subject_id
        where scs.combination_id = st.subject_combination_id
          and upper(trim(cs.code)) = 'MATH_SS'
   )
on conflict (student_id, subject_id) do nothing;

-- ── 5. Check the re-sync landed ──────────────────────────────────────────
do $$
declare
  v_stale bigint;
  v_both_maths bigint;
begin
  select count(*) into v_stale
    from public.student_subjects ss
    join public.subjects s on s.id = ss.subject_id
    join public.students st on st.id = ss.student_id
   where st.subject_combination_id is not null
     and ss.role = 'CORE'
     and upper(trim(s.code)) in ('PE_SS', 'ICT_SS', 'KSL_SS');
  if v_stale > 0 then
    raise exception 'ABORT: % automatic PE/ICT/KSL enrolments remain', v_stale;
  end if;

  select count(*) into v_both_maths
    from public.students st
   where st.subject_combination_id is not null
     and (select count(*)
            from public.student_subjects ss
            join public.subjects s on s.id = ss.subject_id
           where ss.student_id = st.id
             and upper(trim(s.code)) in ('MATH_SS', 'MATH_ESS_SS')) > 1;
  if v_both_maths > 0 then
    raise exception 'ABORT: % learners are enrolled in both Core and Essential Mathematics', v_both_maths;
  end if;
end $$;
