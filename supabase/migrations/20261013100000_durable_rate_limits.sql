-- Rate limits that hold across server instances. The in-memory limiter is
-- per instance (and resets on cold start), so guesses at passwords and invite
-- codes spread over instances were barely slowed. Counted here atomically,
-- for the server only.
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    key          text PRIMARY KEY,
    window_start timestamptz NOT NULL,
    hits         integer NOT NULL
);
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM PUBLIC, anon, authenticated;

-- Counts one hit for p_key in a fixed window of p_window_seconds and says
-- whether it is within p_max. Old keys are swept now and then.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_hits integer;
BEGIN
    INSERT INTO rate_limit_hits AS r (key, window_start, hits)
    VALUES (p_key, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
        window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
    RETURNING hits INTO v_hits;

    IF random() < 0.01 THEN
        DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day';
    END IF;

    RETURN v_hits <= p_max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_hits TO service_role;
