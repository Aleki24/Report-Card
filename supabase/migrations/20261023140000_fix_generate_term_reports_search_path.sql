-- "Generate & download" (Reports) records each learner's report card in
-- report_cards through generate_term_reports(term, stream). That overload was
-- created with an empty search_path but names its tables unqualified, so
-- every call failed with `relation "terms" does not exist` and nothing was
-- recorded: the table held two rows from June. Give it the search path its
-- body expects, as the three-argument overload already has.
ALTER FUNCTION public.generate_term_reports(uuid, uuid) SET search_path = public, pg_temp;
