-- A global subject catalogue that schools choose from.
--
-- Today every school owns physical copies of its subject rows: `subjects`
-- carries a nullable school_id and each school writes its own "Chemistry" with
-- its own id. That is the root of a run of bugs already fixed by hand — an
-- 8-4-4 class sitting a CBC paper, onboarding inventing codes that matched
-- nothing, one school's rows reachable from another's lookups.
--
-- The end state is `subjects` as a catalogue every school can see, plus
-- `school_subjects` saying which ones a school actually offers.
--
-- THIS MIGRATION IS PURELY ADDITIVE. It adds the new structures and fills them
-- from what exists today. It merges nothing, deletes nothing, and drops no
-- column, so the application keeps reading `subjects.school_id` exactly as it
-- does now and this can ship on its own.
--
-- The merge of duplicate rows deliberately comes later, with the application
-- cutover, and not here. Merging collapses two rows into one, and one row can
-- name only one owner — so merging while the app still reads
-- `subjects.school_id` would empty a school's subject list. Rehearsed on a copy
-- of production: all nine of the second school's subjects are merge
-- candidates, so it would have lost every one of them. Once ownership lives in
-- `school_subjects`, the same merge just repoints that school's join row and
-- it keeps everything.

-- ── Catalogue columns on subjects ────────────────────────────────────────

alter table public.subjects
  add column if not exists band text,
  add column if not exists origin_school_id uuid references public.schools(id) on delete cascade;

comment on column public.subjects.band is
    'Curriculum band: PP, LP, UP, JS, SS (CBC) or SEC (8-4-4). academic_levels has a single CBC row spanning Grade 1 to Grade 12, so it cannot tell a Grade 4 subject from a Grade 12 one; this can. Until now the band was inferred at runtime by regex on the code suffix in curriculum-bands.ts.';

comment on column public.subjects.origin_school_id is
    'NULL means a standard subject every school can offer. Set means a subject one school invented, visible only to that school. Distinct from the legacy school_id, which means "this row belongs to this school" and goes away with the application cutover.';

alter table public.subjects
  drop constraint if exists subjects_band_check;
alter table public.subjects
  add constraint subjects_band_check
  check (band is null or band in ('PP','LP','UP','JS','SS','SEC'));

-- ── Which subjects a school offers ───────────────────────────────────────
--
-- grading_system_id lives here rather than on the catalogue: two schools
-- offering Chemistry must be able to grade it differently. It is the one
-- setting that genuinely cannot be global.

create table if not exists public.school_subjects (
    id                uuid primary key default gen_random_uuid(),
    school_id         uuid not null references public.schools(id)         on delete cascade,
    subject_id        uuid not null references public.subjects(id)        on delete cascade,
    grading_system_id uuid          references public.grading_systems(id) on delete set null,
    created_at        timestamptz not null default now(),
    unique (school_id, subject_id)
);

comment on table public.school_subjects is
    'Which subjects each school offers, and how it grades them. Replaces subjects.school_id and subjects.grading_system_id.';

create index if not exists idx_school_subjects_school on public.school_subjects (school_id);
create index if not exists idx_school_subjects_subject on public.school_subjects (subject_id);

alter table public.school_subjects enable row level security;

-- Matches how the rest of this schema reads: authenticated users may read,
-- and every write goes through the server on the service role, which bypasses
-- RLS. Narrowing reads to the caller's own school belongs with the cutover,
-- when the client actually queries this table.
drop policy if exists "Public read school_subjects" on public.school_subjects;
create policy "Public read school_subjects" on public.school_subjects
    for select using (auth.role() = 'authenticated');

-- ── A view that reads like today's table ─────────────────────────────────
--
-- ~20 call sites do `.from('subjects').eq('school_id', schoolId)`. Rewriting
-- each as a join would change every response shape; against this view they
-- change only the table name and keep their select strings and filters.
--
-- Columns are named rather than `s.*` on purpose: while the legacy
-- subjects.school_id still exists, `s.*` collides with school_subjects.school_id
-- and the view will not create. Naming them also means the view's shape does
-- not silently change when a column is added to subjects.
create or replace view public.school_subject_catalogue as
select
    ss.school_id,
    ss.grading_system_id,
    ss.id as offering_id,
    s.id,
    s.code,
    s.name,
    s.academic_level_id,
    s.subject_type,
    s.display_order,
    s.category,
    s.band,
    s.origin_school_id,
    s.created_at
from public.school_subjects ss
join public.subjects s on s.id = ss.subject_id;

comment on view public.school_subject_catalogue is
    'One row per subject a school offers, flattened so it reads like the old subjects table filtered by school_id.';

-- A view runs as its CREATOR unless told otherwise, which would let it read
-- past the caller's row-level security. For a view whose whole purpose is
-- per-school scoping that is exactly backwards: every authenticated user would
-- see every school's subjects through it. Supabase's security advisor flags
-- this as an error, and it is right.
alter view public.school_subject_catalogue set (security_invoker = on);

-- ── Backfill ─────────────────────────────────────────────────────────────

-- Ownership, copied from where it lives today. Idempotent, so a re-run adds
-- nothing and changes nothing.
insert into public.school_subjects (school_id, subject_id, grading_system_id)
select s.school_id, s.id, s.grading_system_id
  from public.subjects s
 where s.school_id is not null
on conflict (school_id, subject_id) do nothing;

-- Band, from the code suffix the catalogue already uses. 8-4-4 codes are bare
-- KNEC numbers with no suffix, so they are identified by their academic level.
update public.subjects s set band = case
    when upper(trim(s.code)) ~ '_PP$' then 'PP'
    when upper(trim(s.code)) ~ '_LP$' then 'LP'
    when upper(trim(s.code)) ~ '_UP$' then 'UP'
    when upper(trim(s.code)) ~ '_JS$' then 'JS'
    when upper(trim(s.code)) ~ '_SS$' then 'SS'
    when al.code = '844' then 'SEC'
    else s.band
  end
from public.academic_levels al
where al.id = s.academic_level_id
  and s.band is null;

-- ── Check the backfill actually landed ───────────────────────────────────
do $$
declare
  v_owned bigint;
  v_offers bigint;
  v_no_band bigint;
  v_lost_grading bigint;
begin
  select count(*) into v_owned  from public.subjects where school_id is not null;
  select count(*) into v_offers from public.school_subjects;
  if v_offers <> v_owned then
    raise exception 'ABORT: % subjects are school-owned but school_subjects has % rows', v_owned, v_offers;
  end if;

  -- Every subject that had a grading system must still resolve one.
  select count(*) into v_lost_grading
    from public.subjects s
    join public.school_subjects ss on ss.subject_id = s.id and ss.school_id = s.school_id
   where s.grading_system_id is not null and ss.grading_system_id is null;
  if v_lost_grading > 0 then
    raise exception 'ABORT: % offerings lost their grading system', v_lost_grading;
  end if;

  select count(*) into v_no_band from public.subjects where band is null;
  if v_no_band > 0 then
    -- Not fatal: a school's own invented code need not follow the convention,
    -- and curriculum-bands.ts still falls back to its heuristics for those.
    raise notice '% subjects have no band; they fall back to code inference', v_no_band;
  end if;
end $$;
