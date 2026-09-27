-- Transport: fleet and NTSA compliance dates, crew, routes and stops, learner
-- assignments, trips with boarding check-in, service logs, and live GPS.
-- Additive only; service-role only.

CREATE TABLE IF NOT EXISTS public.vehicles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    registration            text NOT NULL,
    make_model              text,
    capacity                int NOT NULL CHECK (capacity > 0),
    status                  text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    insurance_expiry        date,
    inspection_expiry       date,
    speed_governor_expiry   date,
    telematics_expiry       date,
    notes                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, registration)
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Drivers and attendants. user_id links a driver to a login for driver mode.
CREATE TABLE IF NOT EXISTS public.transport_crew (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id              text REFERENCES public.users(id) ON DELETE SET NULL,
    full_name            text NOT NULL,
    phone                text,
    crew_role            text NOT NULL DEFAULT 'DRIVER' CHECK (crew_role IN ('DRIVER', 'ATTENDANT')),
    licence_number       text,
    licence_class        text,
    licence_expiry       date,
    psv_badge_expiry     date,
    good_conduct_expiry  date,
    medical_expiry       date,
    created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transport_crew ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.transport_routes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name            text NOT NULL,
    vehicle_id      uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_id       uuid REFERENCES public.transport_crew(id) ON DELETE SET NULL,
    fee_per_term    numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_per_term >= 0),
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.route_stops (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    route_id      uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    name          text NOT NULL,
    sequence      smallint NOT NULL DEFAULT 1,
    pickup_time   time,
    dropoff_time  time,
    lat           double precision CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
    lng           double precision CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS route_stops_route ON public.route_stops (route_id, sequence);
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.student_transport (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id  text NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
    route_id    uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    stop_id     uuid REFERENCES public.route_stops(id) ON DELETE SET NULL,
    direction   text NOT NULL DEFAULT 'BOTH' CHECK (direction IN ('BOTH', 'MORNING', 'EVENING')),
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;

-- SCHEDULED -> IN_PROGRESS -> COMPLETED; or CANCELLED. last_* is the latest
-- GPS fix, kept on the trip so the live map reads one row per bus.
CREATE TABLE IF NOT EXISTS public.trips (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    route_id         uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
    vehicle_id       uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id        uuid REFERENCES public.transport_crew(id) ON DELETE SET NULL,
    direction        text NOT NULL DEFAULT 'MORNING' CHECK (direction IN ('MORNING', 'EVENING', 'OTHER')),
    scheduled_at     timestamptz NOT NULL,
    status           text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    started_at       timestamptz,
    ended_at         timestamptz,
    start_odometer   int,
    end_odometer     int,
    notes            text,
    last_lat         double precision,
    last_lng         double precision,
    last_speed_kmh   numeric(5,1),
    last_seen_at     timestamptz,
    max_speed_kmh    numeric(5,1),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_school_time ON public.trips (school_id, scheduled_at DESC);
-- A vehicle runs one trip at a time.
CREATE UNIQUE INDEX IF NOT EXISTS trips_one_live_per_vehicle
    ON public.trips (vehicle_id) WHERE status = 'IN_PROGRESS';
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.trip_boardings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    trip_id      uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    student_id   text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    event        text NOT NULL CHECK (event IN ('BOARDED', 'ALIGHTED', 'ABSENT')),
    recorded_at  timestamptz NOT NULL DEFAULT now(),
    recorded_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE (trip_id, student_id, event)
);
ALTER TABLE public.trip_boardings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vehicle_positions (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    trip_id      uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    lat          double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng          double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
    speed_kmh    numeric(5,1),
    heading      numeric(5,1),
    accuracy_m   numeric(7,1),
    recorded_at  timestamptz NOT NULL,
    -- A retried batch from an offline phone must not duplicate fixes.
    UNIQUE (trip_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS vehicle_positions_trip_time ON public.vehicle_positions (trip_id, recorded_at);
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vehicle_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    vehicle_id   uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    log_type     text NOT NULL CHECK (log_type IN ('FUEL', 'SERVICE', 'REPAIR', 'INSPECTION', 'OTHER')),
    log_date     date NOT NULL DEFAULT CURRENT_DATE,
    odometer     int,
    litres       numeric(8,2),
    cost         numeric(12,2),
    description  text,
    created_by   text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_logs ENABLE ROW LEVEL SECURITY;
