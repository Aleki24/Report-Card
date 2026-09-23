-- generate_term_reports is SECURITY DEFINER and its role guard reads auth.uid(),
-- which is NULL for the anon key and the service role alike, so the guard
-- compares NULL and falls through. The app now only calls it from
-- /api/school/generate-reports, which authorizes the caller itself and uses the
-- service role. Nothing else should be able to execute it.
revoke execute on function public.generate_term_reports(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.generate_term_reports(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.generate_term_reports(uuid, uuid) to service_role;
grant execute on function public.generate_term_reports(uuid, uuid, uuid) to service_role;
