-- CBC Playgroup: the class before PP1.
--
-- Playgroup learners follow the same learning areas as PP1 and PP2, so it is
-- placed in the Pre-Primary band (see `bandForGrade` in
-- src/lib/curriculum-bands.ts, which reads the `PG` code) and no subjects are
-- added. numeric_order 0 sorts it ahead of PP1 (1) without renumbering the
-- existing grades.
insert into public.grades (academic_level_id, code, name_display, numeric_order, is_exam_class)
select id, 'PG', 'Playgroup', 0, false
  from public.academic_levels
 where code = 'CBC'
on conflict (academic_level_id, code) do nothing;
