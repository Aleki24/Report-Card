-- Option blocks: electives a class takes in parallel (one learner per subject),
-- taught in the same periods by different teachers. Null lets the generator
-- block a class's electives itself when they would not otherwise fit.
alter table public.timetable_requirements
  add column if not exists option_block smallint check (option_block between 1 and 12);

-- A block's electives share the class's slot, one lesson per subject, so a
-- class may now hold several lessons at once, never the same subject twice.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.timetable_lessons'::regclass and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (version_id, grade_stream_id, day, period)';
  if c is not null then execute format('alter table public.timetable_lessons drop constraint %I', c); end if;
end $$;
create unique index if not exists timetable_lessons_class_slot_subject
  on public.timetable_lessons (version_id, grade_stream_id, day, period, subject_id);
