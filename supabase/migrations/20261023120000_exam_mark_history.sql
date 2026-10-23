-- Who changed a mark, from what to what, and when.
--
-- A mark corrected after report cards went out left no trace: the sheet only
-- ever showed the latest score. Every write to exam_marks is now logged by a
-- trigger, so it holds for every path that saves marks (the sheet, file
-- upload, scanning, the phone app, recalculating a multi-paper exam).
--
-- The service role writes every mark, so the database can't tell who the
-- user was: the app stamps exam_marks.updated_by on each save, and the
-- trigger records it. A row saved without it (a recalculation) is logged
-- with no one against it.
ALTER TABLE public.exam_marks ADD COLUMN IF NOT EXISTS updated_by text;

CREATE TABLE IF NOT EXISTS public.exam_mark_history (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id     uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id  text NOT NULL,
    action      text NOT NULL CHECK (action IN ('entered', 'changed', 'removed')),
    old_score   numeric,
    new_score   numeric,
    old_grade   text,
    new_grade   text,
    changed_by  text,
    changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_mark_history_exam_student_idx
    ON public.exam_mark_history (exam_id, student_id, changed_at DESC);

ALTER TABLE public.exam_mark_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_mark_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.exam_mark_history TO service_role;

CREATE OR REPLACE FUNCTION public.log_exam_mark_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO exam_mark_history (exam_id, student_id, action, new_score, new_grade, changed_by)
        VALUES (NEW.exam_id, NEW.student_id, 'entered', NEW.raw_score, NEW.grade_symbol, NEW.updated_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only a change someone would see: re-saving the same score is not one.
        IF NEW.raw_score IS DISTINCT FROM OLD.raw_score OR NEW.grade_symbol IS DISTINCT FROM OLD.grade_symbol THEN
            INSERT INTO exam_mark_history (exam_id, student_id, action, old_score, new_score, old_grade, new_grade, changed_by)
            VALUES (NEW.exam_id, NEW.student_id, 'changed', OLD.raw_score, NEW.raw_score, OLD.grade_symbol, NEW.grade_symbol, NEW.updated_by);
        END IF;
        RETURN NEW;
    ELSE
        -- Deleting the exam removes its marks and its history together:
        -- nothing to log once the exam itself is gone.
        IF EXISTS (SELECT 1 FROM exams WHERE id = OLD.exam_id) THEN
            INSERT INTO exam_mark_history (exam_id, student_id, action, old_score, old_grade, changed_by)
            VALUES (OLD.exam_id, OLD.student_id, 'removed', OLD.raw_score, OLD.grade_symbol, OLD.updated_by);
        END IF;
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS exam_marks_history ON public.exam_marks;
CREATE TRIGGER exam_marks_history
    AFTER INSERT OR UPDATE OR DELETE ON public.exam_marks
    FOR EACH ROW EXECUTE FUNCTION public.log_exam_mark_change();
