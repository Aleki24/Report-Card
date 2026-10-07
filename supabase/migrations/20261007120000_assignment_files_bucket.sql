-- Homework attachments (teachers' worksheets, learners' hand-ins) are stored
-- in their own bucket. /api/school/upload made it on first use, so no school
-- had one yet and nothing had ever been uploaded; create it up front with the
-- same 10 MB limit the upload route enforces.
insert into storage.buckets (id, name, public, file_size_limit)
values ('assignment-files', 'assignment-files', true, 10485760)
on conflict (id) do nothing;
