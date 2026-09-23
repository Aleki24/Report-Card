-- Senior School "Religious Education" (RE_SS) → Christian Religious Education.
--
-- The Ministry's combinations name CRE, IRE and HRE separately, so a learner
-- recorded under the old combined RE_SS matches no official combination. The
-- one school offering RE_SS confirmed (23 Sep 2026) that its RE learners take
-- CRE. Recoding the row in place keeps every exam and mark attached: they
-- reference the subject by id, and the id does not change.
--
-- Guarded so it cannot merge two subjects or relabel another school's RE:
-- it runs only while RE_SS is a single catalogue row offered by at most one
-- school and no CRE_SS row exists yet. Otherwise it changes nothing.
do $$
declare
  v_re uuid;
  v_offered int;
begin
  select id into v_re
    from public.subjects
   where upper(trim(code)) = 'RE_SS' and origin_school_id is null;
  if v_re is null then
    raise notice 'No RE_SS catalogue row; nothing to do';
    return;
  end if;

  if exists (select 1 from public.subjects where upper(trim(code)) = 'CRE_SS') then
    raise notice 'CRE_SS already exists; leaving RE_SS alone rather than merging';
    return;
  end if;

  select count(*) into v_offered from public.school_subjects where subject_id = v_re;
  if v_offered > 1 then
    raise notice 'RE_SS is offered by % schools; not relabelling it for all of them', v_offered;
    return;
  end if;

  update public.subjects
     set code = 'CRE_SS', name = 'Christian Religious Education'
   where id = v_re;
end $$;
