-- Publishing a timetable and moving a lesson were several statements sent one
-- by one: a failure between "archive the live timetable" and "publish the new
-- one" left the school with no live timetable, and a failure mid-swap left
-- lessons parked outside the grid. Each now runs as one transaction.

-- Archives the school's live timetable and publishes p_version_id, or does
-- neither. Returns the published row, or nothing when the version is not the
-- school's.
create or replace function public.publish_timetable_version(p_school_id uuid, p_version_id uuid)
returns setof public.timetable_versions
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from timetable_versions where id = p_version_id and school_id = p_school_id) then
    return;
  end if;
  update timetable_versions set status = 'ARCHIVED'
    where school_id = p_school_id and status = 'PUBLISHED' and id <> p_version_id;
  return query
    update timetable_versions set status = 'PUBLISHED', published_at = now()
    where id = p_version_id and school_id = p_school_id
    returning *;
end;
$$;

-- Moves p_group (one class slot, an option block's lessons together) to
-- (p_to_day, p_to_period) and the lessons already there, p_swap, back to
-- (p_from_day, p_from_period). The swapped lessons are parked at p_park_period
-- first: the class-slot-subject index is checked row by row, so moving both
-- sets straight across could collide midway.
create or replace function public.swap_timetable_slot(
  p_version_id uuid,
  p_group uuid[],
  p_swap uuid[],
  p_to_day smallint,
  p_to_period smallint,
  p_from_day smallint,
  p_from_period smallint,
  p_park_period smallint,
  p_lesson uuid,
  p_room uuid,
  p_locked boolean
)
returns void
language plpgsql
set search_path = public
as $$
begin
  update timetable_lessons set period = p_park_period
    where version_id = p_version_id and id = any(p_swap);
  update timetable_lessons set day = p_to_day, period = p_to_period, locked = coalesce(p_locked, locked)
    where version_id = p_version_id and id = any(p_group);
  update timetable_lessons set room_id = p_room
    where version_id = p_version_id and id = p_lesson and room_id is distinct from p_room;
  update timetable_lessons set day = p_from_day, period = p_from_period
    where version_id = p_version_id and id = any(p_swap);
end;
$$;

-- Server routes call these with the service role; nobody else may.
revoke execute on function public.publish_timetable_version(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.swap_timetable_slot(uuid, uuid[], uuid[], smallint, smallint, smallint, smallint, smallint, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.publish_timetable_version(uuid, uuid) to service_role;
grant execute on function public.swap_timetable_slot(uuid, uuid[], uuid[], smallint, smallint, smallint, smallint, smallint, uuid, uuid, boolean) to service_role;
