-- Platform foundation: per-school modules, staff duties, and an audit log.
--
-- Additive only. A school with no school_modules rows keeps every module that
-- existed before this migration (the registry in src/lib/platform/modules.ts
-- defaults them on), and a user with no duties keeps exactly what their login
-- role allowed. Nothing changes for a live school until an admin chooses.
--
-- Like every table since 20260925120000, these are read and written only by
-- the service-role client from API routes: RLS is on with no policies, and
-- anon/authenticated have no grants (default privileges already revoke them).

-- 1. Modules a school runs ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_modules (
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    module_key  text NOT NULL,
    -- Platform owner: whether the school's plan includes the module.
    entitled    boolean NOT NULL DEFAULT true,
    -- School admin: whether the school has switched it on.
    enabled     boolean NOT NULL DEFAULT false,
    -- Per-module preferences, validated in the app by each module's schema.
    settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (school_id, module_key)
);
ALTER TABLE public.school_modules ENABLE ROW LEVEL SECURITY;

-- 2. Duties: the jobs a person holds, which grant permissions -------------
-- duty is text with a CHECK (not an enum) so new duties ship in an ordinary
-- transactional migration; ALTER TYPE ... ADD VALUE cannot.
CREATE TABLE IF NOT EXISTS public.user_duties (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    duty        text NOT NULL CHECK (duty IN (
        'PRINCIPAL', 'DEPUTY_PRINCIPAL', 'DOS', 'HOD', 'TIMETABLER', 'EXAMS_OFFICER',
        'BURSAR', 'ACCOUNTANT', 'MATRON', 'PATRON', 'NURSE', 'DISCIPLINE_MASTER',
        'TRANSPORT_MANAGER', 'DRIVER', 'LIBRARIAN', 'STOREKEEPER', 'HR_OFFICER'
    )),
    -- Optional limit: a department, a class, a dorm, a vehicle or a route.
    scope_type  text CHECK (scope_type IN ('DEPARTMENT', 'STREAM', 'DORM', 'VEHICLE', 'ROUTE')),
    scope_id    uuid,
    -- Optional dates, for a term's duty roster.
    starts_on   date,
    ends_on     date,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    CHECK ((scope_type IS NULL) = (scope_id IS NULL)),
    CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
-- One row per person per duty per scope (NULL scopes compared as equal).
CREATE UNIQUE INDEX IF NOT EXISTS user_duties_unique
    ON public.user_duties (school_id, user_id, duty, coalesce(scope_type, ''), coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS user_duties_user ON public.user_duties (user_id, school_id);
ALTER TABLE public.user_duties ENABLE ROW LEVEL SECURITY;

-- 3. Audit log: money movements, sensitive reads, configuration changes ---
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    actor_id    text REFERENCES public.users(id) ON DELETE SET NULL,
    action      text NOT NULL,          -- e.g. 'create', 'update', 'delete', 'view', 'approve'
    entity      text NOT NULL,          -- table or resource name
    entity_id   text,
    details     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_school_time ON public.audit_log (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity ON public.audit_log (school_id, entity, entity_id);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
