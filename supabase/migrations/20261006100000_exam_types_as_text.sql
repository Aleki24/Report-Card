-- Schools sit exams the built-in list does not name (KNEC SBA, joint exams).
-- exams.exam_type was a fixed Postgres enum, so any other name failed to
-- insert. Store it as text; the API checks it (src/lib/exam-types.ts:
-- isValidExamType) and every existing value keeps its spelling.

ALTER TABLE public.exams ALTER COLUMN exam_type TYPE text USING exam_type::text;
