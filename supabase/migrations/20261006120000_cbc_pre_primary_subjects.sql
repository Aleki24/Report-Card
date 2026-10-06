-- CBC Pre-primary learning areas (Playgroup, PP1, PP2).
--
-- Pre-primary used to borrow the Grade 1–3 subjects, so a school with only
-- PP classes, or one whose Lower Primary subjects are no longer read as
-- Pre-primary (see `curriculum-bands.ts`), had none. These are the KICD
-- Pre-primary activity areas, added to the shared catalogue and offered to
-- every school that runs a Playgroup or PP class. Additive and idempotent.
insert into public.subjects (code, name, academic_level_id, subject_type, category, display_order, band, origin_school_id)
select v.code, v.name, l.id, 'CORE', v.category, v.ord, 'PP', null
  from public.academic_levels l
  cross join (values
    ('LANG_PP', 'Language Activities', 'LANGUAGE', 0),
    ('MATH_PP', 'Mathematical Activities', 'MATHEMATICS', 1),
    ('ENV_PP', 'Environmental Activities', 'SCIENCE', 2),
    ('PCA_PP', 'Psychomotor and Creative Activities', 'CREATIVE', 3),
    ('RE_PP', 'Religious Education Activities', 'HUMANITY', 4)
  ) as v(code, name, category, ord)
 where l.code = 'CBC'
   and not exists (select 1 from public.subjects s where upper(s.code) = v.code and s.origin_school_id is null);

insert into public.school_subjects (school_id, subject_id)
select distinct gs.school_id, s.id
  from public.grade_streams gs
  join public.grades g on g.id = gs.grade_id
  join public.subjects s on s.origin_school_id is null and s.code in ('LANG_PP', 'MATH_PP', 'ENV_PP', 'PCA_PP', 'RE_PP')
 where g.code in ('PG', 'PP1', 'PP2')
on conflict (school_id, subject_id) do nothing;
