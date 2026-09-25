-- Make the analytics rollups callable by the server only.
--
-- Supabase grants EXECUTE on functions in the public schema to anon and
-- authenticated directly (not through PUBLIC), so the earlier
-- "revoke ... from public" left every rollup callable with the browser's anon
-- key, for any p_school_id. Row-level security currently stops those calls
-- (the get_my_role() policy helper errors for them), but that is an accident
-- of a broken helper, not a guarantee. Every caller is an API route using the
-- service-role client, so nothing else needs these.

revoke execute on function public.school_class_performance(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.school_unmarked_exams(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.school_mark_summary(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.class_subject_performance(uuid, uuid, uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.class_merit_list(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.class_exam_series(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.school_class_performance(uuid, uuid, numeric) to service_role;
grant execute on function public.school_unmarked_exams(uuid, uuid) to service_role;
grant execute on function public.school_mark_summary(uuid, uuid, numeric) to service_role;
grant execute on function public.class_subject_performance(uuid, uuid, uuid, text, numeric) to service_role;
grant execute on function public.class_merit_list(uuid, uuid, uuid, text) to service_role;
grant execute on function public.class_exam_series(uuid, uuid, uuid) to service_role;
