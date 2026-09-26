-- Boarding (dorms, beds, roll calls, exeats, inspections) and health
-- (medical profiles, clinic visits and sick bay, medication, stock).
-- Additive only; service-role only. Health rows are sensitive personal data
-- under the Data Protection Act, 2019: the app limits clinical detail to the
-- nurse and principal and audits every change.

-- 1. Boarding ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dorms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name        text NOT NULL,
    house       text,
    gender      text NOT NULL DEFAULT 'MIXED' CHECK (gender IN ('MALE', 'FEMALE', 'MIXED')),
    capacity    int NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    patron_id   text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);
ALTER TABLE public.dorms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dorm_allocations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    dorm_id       uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
    student_id    text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    bed_label     text,
    allocated_on  date NOT NULL DEFAULT CURRENT_DATE,
    ended_on      date,
    created_at    timestamptz NOT NULL DEFAULT now()
);
-- A learner sleeps in one place at a time.
CREATE UNIQUE INDEX IF NOT EXISTS dorm_allocations_one_active
    ON public.dorm_allocations (student_id) WHERE ended_on IS NULL;
CREATE INDEX IF NOT EXISTS dorm_allocations_dorm ON public.dorm_allocations (dorm_id) WHERE ended_on IS NULL;
ALTER TABLE public.dorm_allocations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.roll_calls (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    dorm_id     uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
    session     text NOT NULL CHECK (session IN ('MORNING', 'EVENING', 'NIGHT')),
    taken_on    date NOT NULL,
    taken_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dorm_id, session, taken_on)
);
ALTER TABLE public.roll_calls ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.roll_call_entries (
    roll_call_id  uuid NOT NULL REFERENCES public.roll_calls(id) ON DELETE CASCADE,
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id    text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status        text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXEAT', 'SICK_BAY')),
    PRIMARY KEY (roll_call_id, student_id)
);
ALTER TABLE public.roll_call_entries ENABLE ROW LEVEL SECURITY;

-- PENDING -> APPROVED | REJECTED; APPROVED -> OUT -> RETURNED
CREATE TABLE IF NOT EXISTS public.exeats (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id    text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exeat_type    text NOT NULL DEFAULT 'WEEKEND' CHECK (exeat_type IN ('WEEKEND', 'MEDICAL', 'FAMILY', 'OFFICIAL', 'OTHER')),
    leave_at      timestamptz NOT NULL,
    return_by     timestamptz NOT NULL,
    reason        text,
    status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'OUT', 'RETURNED')),
    pass_code     text,
    requested_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    left_at       timestamptz,
    returned_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (return_by > leave_at)
);
CREATE INDEX IF NOT EXISTS exeats_school_status ON public.exeats (school_id, status);
ALTER TABLE public.exeats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dorm_inspections (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    dorm_id       uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
    inspected_on  date NOT NULL DEFAULT CURRENT_DATE,
    score         smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
    remarks       text,
    inspected_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dorm_inspections ENABLE ROW LEVEL SECURITY;

-- 2. Health --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_profiles (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id         text NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
    blood_group        text CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    allergies          text,
    conditions         text,
    regular_medication text,
    sha_number         text,
    doctor_name        text,
    doctor_phone       text,
    emergency_contact  text,
    emergency_phone    text,
    consent_on_file    boolean NOT NULL DEFAULT false,
    notes              text,
    created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_profiles ENABLE ROW LEVEL SECURITY;

-- A visit whose outcome is SICK_BAY and has no discharged_at is in sick bay now.
CREATE TABLE IF NOT EXISTS public.clinic_visits (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id       text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    visited_at       timestamptz NOT NULL DEFAULT now(),
    complaint        text NOT NULL,
    temperature_c    numeric(4,1) CHECK (temperature_c IS NULL OR temperature_c BETWEEN 30 AND 45),
    diagnosis        text,
    treatment        text,
    outcome          text NOT NULL DEFAULT 'RETURNED_TO_CLASS' CHECK (outcome IN ('RETURNED_TO_CLASS', 'SICK_BAY', 'SENT_HOME', 'REFERRED')),
    referred_to      text,
    parent_notified  boolean NOT NULL DEFAULT false,
    discharged_at    timestamptz,
    attended_by      text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinic_visits_school_time ON public.clinic_visits (school_id, visited_at DESC);
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.medicine_stock (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name           text NOT NULL,
    unit           text NOT NULL DEFAULT 'tablet',
    quantity       int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level  int NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    batch          text,
    expiry_date    date,
    created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicine_stock ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.medication_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id   text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    stock_id     uuid REFERENCES public.medicine_stock(id) ON DELETE SET NULL,
    medicine     text NOT NULL,
    dose         text,
    quantity     int NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    given_at     timestamptz NOT NULL DEFAULT now(),
    given_by     text REFERENCES public.users(id) ON DELETE SET NULL,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

-- Dispensing from stock takes it off the shelf; the CHECK on quantity refuses
-- dispensing more than is left, so stock can never go negative.
CREATE OR REPLACE FUNCTION public.medication_logs_take_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.stock_id IS NOT NULL AND NEW.quantity > 0 THEN
        UPDATE public.medicine_stock
           SET quantity = quantity - NEW.quantity
         WHERE id = NEW.stock_id AND school_id = NEW.school_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS medication_logs_take_stock ON public.medication_logs;
CREATE TRIGGER medication_logs_take_stock
    AFTER INSERT ON public.medication_logs
    FOR EACH ROW EXECUTE FUNCTION public.medication_logs_take_stock();

REVOKE EXECUTE ON FUNCTION public.medication_logs_take_stock() FROM public, anon, authenticated;
