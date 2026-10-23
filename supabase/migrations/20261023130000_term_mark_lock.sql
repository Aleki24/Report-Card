-- Lock a finished term's marks.
--
-- Once a term's report cards are out, a stray edit (a teacher on last term's
-- sheet, a re-uploaded file) quietly changed what parents had been given.
-- Whoever opens exams for marking (admins, the principal, deputy, DOS, exams
-- officer) can now lock a term; its marks and paper scores then can't be
-- added, changed or removed until they unlock it. Enforced here so it holds
-- for every way marks are saved; the app checks first to explain why.
ALTER TABLE public.terms ADD COLUMN IF NOT EXISTS marks_locked_at timestamptz;
ALTER TABLE public.terms ADD COLUMN IF NOT EXISTS marks_locked_by text;

CREATE OR REPLACE FUNCTION public.enforce_term_mark_lock() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
AS $$
DECLARE
    v_exam uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN v_exam := OLD.exam_id; ELSE v_exam := NEW.exam_id; END IF;
    IF EXISTS (
        SELECT 1 FROM exams e JOIN terms t ON t.id = e.term_id
        WHERE e.id = v_exam AND t.marks_locked_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Marks for this term are locked. Ask the admin or DOS to unlock the term first.'
            USING ERRCODE = 'P0001', HINT = 'term_locked';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_marks_term_lock ON public.exam_marks;
CREATE TRIGGER exam_marks_term_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.exam_marks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_term_mark_lock();

DROP TRIGGER IF EXISTS exam_mark_components_term_lock ON public.exam_mark_components;
CREATE TRIGGER exam_mark_components_term_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.exam_mark_components
    FOR EACH ROW EXECUTE FUNCTION public.enforce_term_mark_lock();
