-- Promotion can leave learners pending.
--
-- Grade 9s are placed into Senior School nationally after the year closes,
-- and a school still adding Senior School grades can't move its top class
-- up. Rather than hold up every other class, the plan marks them PENDING:
-- they keep their class and records and leave the roll, and a follow-up step
-- of the same year's promotion decides them later. Every step is its own run,
-- undone latest first, so a year can now have several live runs.
--
-- A learner is decided once a year: only one still pending can be decided
-- again, and the API refuses a second full promotion of a year.

ALTER TABLE public.student_promotion_runs ADD COLUMN IF NOT EXISTS pending integer NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS public.uq_student_promotion_runs_live;
CREATE INDEX IF NOT EXISTS idx_student_promotion_runs_live
    ON public.student_promotion_runs(school_id, academic_year_id) WHERE undone_at IS NULL;

ALTER TABLE public.student_promotions DROP CONSTRAINT IF EXISTS student_promotions_outcome_check;
ALTER TABLE public.student_promotions ADD CONSTRAINT student_promotions_outcome_check
    CHECK (outcome IN ('PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER', 'PENDING'));

-- Applies a promotion plan, or nothing. p_decisions is a JSON array of
-- { student_id, from_stream_id, to_stream_id, outcome }, one per learner.
-- Every learner must still be in from_stream_id, on the roll or pending: a
-- plan made from a class list that has since changed is refused rather than
-- half-applied.
CREATE OR REPLACE FUNCTION public.run_student_promotion(
    p_school_id uuid,
    p_academic_year_id uuid,
    p_actor text,
    p_decisions jsonb
) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = public
AS $$
DECLARE
    v_run uuid;
    v_wanted integer;
    v_matched integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_academic_year_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'That academic year is not your school''s.' USING ERRCODE = 'P0001', HINT = 'bad_year';
    END IF;

    IF to_regclass('pg_temp._decisions') IS NOT NULL THEN DROP TABLE pg_temp._decisions; END IF;
    CREATE TEMP TABLE _decisions ON COMMIT DROP AS
        SELECT d.student_id, d.from_stream_id, d.to_stream_id, d.outcome
        FROM jsonb_to_recordset(p_decisions) AS d(student_id text, from_stream_id uuid, to_stream_id uuid, outcome text);

    SELECT count(*), count(DISTINCT student_id) INTO v_wanted, v_matched FROM _decisions;
    IF v_wanted = 0 OR v_wanted <> v_matched THEN
        RAISE EXCEPTION 'Each learner needs exactly one decision.' USING ERRCODE = 'P0001', HINT = 'bad_plan';
    END IF;

    -- Promotions land in a class of this school; nobody else changes class.
    IF EXISTS (
        SELECT 1 FROM _decisions d
        LEFT JOIN grade_streams g ON g.id = d.to_stream_id AND g.school_id = p_school_id
        WHERE d.outcome NOT IN ('PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER', 'PENDING')
           OR (d.outcome = 'PROMOTE') <> (d.to_stream_id IS NOT NULL)
           OR (d.to_stream_id IS NOT NULL AND g.id IS NULL)
    ) THEN
        RAISE EXCEPTION 'The plan sends a learner to a class that is not your school''s.' USING ERRCODE = 'P0001', HINT = 'bad_plan';
    END IF;

    -- Lock the learners, then check they are where the plan found them.
    PERFORM 1 FROM students s JOIN _decisions d ON d.student_id = s.id FOR UPDATE OF s;
    SELECT count(*) INTO v_matched
    FROM students s JOIN _decisions d ON d.student_id = s.id
    WHERE s.school_id = p_school_id AND s.status IN ('ACTIVE', 'PENDING') AND s.current_grade_stream_id = d.from_stream_id;
    IF v_matched <> v_wanted THEN
        RAISE EXCEPTION 'Some learners have changed class or left since this plan was made. Reload and check again.'
            USING ERRCODE = 'P0001', HINT = 'stale_plan';
    END IF;

    -- Only a learner still pending is decided twice in a year.
    IF EXISTS (
        SELECT 1 FROM _decisions d
        JOIN student_promotions p ON p.student_id = d.student_id AND p.outcome <> 'PENDING'
        JOIN student_promotion_runs r ON r.id = p.run_id
        WHERE r.academic_year_id = p_academic_year_id AND r.undone_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Learners have already been promoted this academic year. Undo that promotion first to run it again.'
            USING ERRCODE = 'P0001', HINT = 'already_run';
    END IF;

    INSERT INTO student_promotion_runs (school_id, academic_year_id, run_by, promoted, repeated, graduated, transferred, pending)
    SELECT p_school_id, p_academic_year_id, p_actor,
           count(*) FILTER (WHERE outcome = 'PROMOTE'),
           count(*) FILTER (WHERE outcome = 'REPEAT'),
           count(*) FILTER (WHERE outcome = 'GRADUATE'),
           count(*) FILTER (WHERE outcome = 'TRANSFER'),
           count(*) FILTER (WHERE outcome = 'PENDING')
    FROM _decisions
    RETURNING id INTO v_run;

    INSERT INTO student_promotions (run_id, school_id, student_id, outcome, from_stream_id, to_stream_id, previous_status, new_status)
    SELECT v_run, p_school_id, d.student_id, d.outcome, d.from_stream_id, d.to_stream_id, s.status,
           (CASE d.outcome
                WHEN 'GRADUATE' THEN 'GRADUATED'
                WHEN 'TRANSFER' THEN 'TRANSFERRED'
                WHEN 'PENDING' THEN 'PENDING'
                ELSE 'ACTIVE'
            END)::student_status
    FROM _decisions d
    JOIN students s ON s.id = d.student_id;

    UPDATE students s
    SET current_grade_stream_id = coalesce(p.to_stream_id, s.current_grade_stream_id),
        status = p.new_status
    FROM student_promotions p
    WHERE p.run_id = v_run AND p.student_id = s.id
      AND (p.to_stream_id IS NOT NULL OR p.previous_status <> p.new_status);

    RETURN v_run;
END;
$$;

-- Undoes the school's latest live run: each learner it changed goes back to
-- the class and status they had before it (a learner it decided after being
-- pending goes back to pending). A learner changed since (moved by hand,
-- re-admitted) is left alone and counted as skipped.
CREATE OR REPLACE FUNCTION public.undo_student_promotion(p_school_id uuid, p_run_id uuid, p_actor text)
RETURNS TABLE (restored integer, skipped integer)
    LANGUAGE plpgsql
    SET search_path = public
AS $$
DECLARE
    v_total integer;
    v_restored integer;
BEGIN
    PERFORM 1 FROM student_promotion_runs
    WHERE id = p_run_id AND school_id = p_school_id AND undone_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That promotion is not your school''s, or has already been undone.' USING ERRCODE = 'P0001', HINT = 'not_found';
    END IF;
    IF EXISTS (
        SELECT 1 FROM student_promotion_runs
        WHERE school_id = p_school_id AND undone_at IS NULL AND id <> p_run_id
          AND created_at > (SELECT created_at FROM student_promotion_runs WHERE id = p_run_id)
    ) THEN
        RAISE EXCEPTION 'A later promotion has been run. Undo that one first.' USING ERRCODE = 'P0001', HINT = 'not_latest';
    END IF;

    SELECT count(*) INTO v_total
    FROM student_promotions p
    WHERE p.run_id = p_run_id AND (p.to_stream_id IS NOT NULL OR p.previous_status <> p.new_status);

    UPDATE students s
    SET current_grade_stream_id = p.from_stream_id,
        status = p.previous_status
    FROM student_promotions p
    WHERE p.run_id = p_run_id AND p.student_id = s.id
      AND (p.to_stream_id IS NOT NULL OR p.previous_status <> p.new_status)
      AND s.current_grade_stream_id = coalesce(p.to_stream_id, p.from_stream_id)
      AND s.status = p.new_status;
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    UPDATE student_promotion_runs SET undone_at = now(), undone_by = p_actor WHERE id = p_run_id;

    RETURN QUERY SELECT v_restored, v_total - v_restored;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_student_promotion(uuid, uuid, text, jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.undo_student_promotion(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_student_promotion(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_student_promotion(uuid, uuid, text) TO service_role;
