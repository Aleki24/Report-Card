-- End-of-year promotion: every learner moves up a class, repeats, or leaves.
--
-- Moving learners one by one on the People page took an afternoon and left
-- half the school promoted when it was interrupted. A promotion run applies
-- the admin's whole plan in one transaction and remembers where each learner
-- came from, so the run can be undone if the plan was wrong.
--
-- Outcomes (src/lib/promotion.ts decides which are allowed for each grade):
--   PROMOTE   moves to a class in the next grade, stays ACTIVE
--   REPEAT    stays in their class, stays ACTIVE
--   GRADUATE  completed the school's last grade, or completed Grade 9 and is
--             going to Senior School elsewhere: archived as GRADUATED
--   TRANSFER  leaving for another school: archived as TRANSFERRED
-- Archived learners keep their last class, so they are still found under it.
--
-- One live run per school per academic year; an undone run frees the year.
-- Server-only: RLS on, no policies, functions for the service role only.
-- User and student ids are text (Clerk ids such as user_…), not uuid.

CREATE TABLE IF NOT EXISTS public.student_promotion_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    run_by text REFERENCES public.users(id) ON DELETE SET NULL,
    promoted integer NOT NULL DEFAULT 0,
    repeated integer NOT NULL DEFAULT 0,
    graduated integer NOT NULL DEFAULT 0,
    transferred integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    undone_at timestamptz,
    undone_by text REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_promotion_runs_live
    ON public.student_promotion_runs(school_id, academic_year_id) WHERE undone_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_promotion_runs_school
    ON public.student_promotion_runs(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.student_promotion_runs(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    outcome text NOT NULL CHECK (outcome IN ('PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER')),
    from_stream_id uuid NOT NULL REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    to_stream_id uuid REFERENCES public.grade_streams(id) ON DELETE CASCADE,
    previous_status student_status NOT NULL,
    new_status student_status NOT NULL,
    UNIQUE (run_id, student_id),
    -- Only a promotion changes class.
    CHECK ((outcome = 'PROMOTE') = (to_stream_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student ON public.student_promotions(student_id);

ALTER TABLE public.student_promotion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_promotion_runs FROM anon, authenticated;
REVOKE ALL ON public.student_promotions FROM anon, authenticated;

-- Applies a promotion plan, or nothing. p_decisions is a JSON array of
-- { student_id, from_stream_id, to_stream_id, outcome }, one per learner.
-- Every learner must still be ACTIVE in from_stream_id: a plan made from a
-- class list that has since changed is refused rather than half-applied.
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
        WHERE d.outcome NOT IN ('PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER')
           OR (d.outcome = 'PROMOTE') <> (d.to_stream_id IS NOT NULL)
           OR (d.to_stream_id IS NOT NULL AND g.id IS NULL)
    ) THEN
        RAISE EXCEPTION 'The plan sends a learner to a class that is not your school''s.' USING ERRCODE = 'P0001', HINT = 'bad_plan';
    END IF;

    -- Lock the learners, then check they are where the plan found them.
    PERFORM 1 FROM students s JOIN _decisions d ON d.student_id = s.id FOR UPDATE OF s;
    SELECT count(*) INTO v_matched
    FROM students s JOIN _decisions d ON d.student_id = s.id
    WHERE s.school_id = p_school_id AND s.status = 'ACTIVE' AND s.current_grade_stream_id = d.from_stream_id;
    IF v_matched <> v_wanted THEN
        RAISE EXCEPTION 'Some learners have changed class or left since this plan was made. Reload and check again.'
            USING ERRCODE = 'P0001', HINT = 'stale_plan';
    END IF;

    BEGIN
        INSERT INTO student_promotion_runs (school_id, academic_year_id, run_by, promoted, repeated, graduated, transferred)
        SELECT p_school_id, p_academic_year_id, p_actor,
               count(*) FILTER (WHERE outcome = 'PROMOTE'),
               count(*) FILTER (WHERE outcome = 'REPEAT'),
               count(*) FILTER (WHERE outcome = 'GRADUATE'),
               count(*) FILTER (WHERE outcome = 'TRANSFER')
        FROM _decisions
        RETURNING id INTO v_run;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Learners have already been promoted this academic year. Undo that promotion first to run it again.'
            USING ERRCODE = 'P0001', HINT = 'already_run';
    END;

    INSERT INTO student_promotions (run_id, school_id, student_id, outcome, from_stream_id, to_stream_id, previous_status, new_status)
    SELECT v_run, p_school_id, d.student_id, d.outcome, d.from_stream_id, d.to_stream_id, 'ACTIVE',
           (CASE d.outcome WHEN 'GRADUATE' THEN 'GRADUATED' WHEN 'TRANSFER' THEN 'TRANSFERRED' ELSE 'ACTIVE' END)::student_status
    FROM _decisions d;

    UPDATE students s
    SET current_grade_stream_id = coalesce(p.to_stream_id, s.current_grade_stream_id),
        status = p.new_status
    FROM student_promotions p
    WHERE p.run_id = v_run AND p.student_id = s.id AND p.outcome <> 'REPEAT';

    RETURN v_run;
END;
$$;

-- Undoes the school's latest live run: each learner goes back to the class
-- and status they had before it. A learner changed since (moved by hand,
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

    SELECT count(*) INTO v_total FROM student_promotions WHERE run_id = p_run_id AND outcome <> 'REPEAT';

    UPDATE students s
    SET current_grade_stream_id = p.from_stream_id,
        status = p.previous_status
    FROM student_promotions p
    WHERE p.run_id = p_run_id AND p.student_id = s.id AND p.outcome <> 'REPEAT'
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
