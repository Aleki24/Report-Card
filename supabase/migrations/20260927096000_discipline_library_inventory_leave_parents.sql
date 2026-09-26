-- Discipline, library, inventory and stores, staff leave, and parent accounts.
-- Additive only; service-role only.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block. Run
-- the first statement on its own (as the STAFF role migration did) if your
-- migration runner wraps files in a transaction.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PARENT';

-- 1. Discipline -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipline_incidents (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id       text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    occurred_on      date NOT NULL DEFAULT CURRENT_DATE,
    category         text NOT NULL CHECK (category IN (
        'LATENESS', 'TRUANCY', 'FIGHTING', 'BULLYING', 'CHEATING', 'INSUBORDINATION',
        'PROPERTY_DAMAGE', 'SUBSTANCE', 'UNIFORM', 'OTHER'
    )),
    severity         text NOT NULL DEFAULT 'MINOR' CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
    description      text NOT NULL,
    action_taken     text NOT NULL DEFAULT 'NONE' CHECK (action_taken IN (
        'NONE', 'WARNING', 'COUNSELLING', 'PUNISHMENT', 'PARENT_CALLED', 'SUSPENSION', 'EXPULSION'
    )),
    status           text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    parent_notified  boolean NOT NULL DEFAULT false,
    reported_by      text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discipline_incidents_student ON public.discipline_incidents (school_id, student_id);
ALTER TABLE public.discipline_incidents ENABLE ROW LEVEL SECURITY;

-- 2. Library --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_books (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title         text NOT NULL,
    author        text,
    isbn          text,
    category      text,
    shelf         text,
    copies_total  int NOT NULL DEFAULT 1 CHECK (copies_total >= 0),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_books_school_title ON public.library_books (school_id, title);
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.library_loans (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id      uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
    borrower_id  text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    issued_on    date NOT NULL DEFAULT CURRENT_DATE,
    due_on       date NOT NULL,
    returned_on  date,
    fine_amount  numeric(10,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    issued_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (due_on >= issued_on)
);
CREATE INDEX IF NOT EXISTS library_loans_open ON public.library_loans (book_id) WHERE returned_on IS NULL;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;

-- A book cannot be issued when every copy is already out.
CREATE OR REPLACE FUNCTION public.library_loans_check_available()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    total int;
    out_now int;
BEGIN
    IF NEW.returned_on IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT copies_total INTO total FROM public.library_books WHERE id = NEW.book_id FOR UPDATE;
    SELECT count(*) INTO out_now FROM public.library_loans
     WHERE book_id = NEW.book_id AND returned_on IS NULL AND id <> NEW.id;
    IF out_now >= coalesce(total, 0) THEN
        RAISE EXCEPTION 'No copies of this book are available' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_loans_check_available ON public.library_loans;
CREATE TRIGGER library_loans_check_available
    BEFORE INSERT ON public.library_loans
    FOR EACH ROW EXECUTE FUNCTION public.library_loans_check_available();
REVOKE EXECUTE ON FUNCTION public.library_loans_check_available() FROM public, anon, authenticated;

-- 3. Inventory and stores -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name           text NOT NULL,
    item_type      text NOT NULL DEFAULT 'CONSUMABLE' CHECK (item_type IN ('ASSET', 'CONSUMABLE')),
    category       text,
    unit           text NOT NULL DEFAULT 'pcs',
    quantity       numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level  numeric(12,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    location       text,
    serial_number  text,
    unit_value     numeric(12,2),
    created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- PENDING -> APPROVED | REJECTED; APPROVED -> ISSUED
CREATE TABLE IF NOT EXISTS public.store_requisitions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    item_id       uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity      numeric(12,2) NOT NULL CHECK (quantity > 0),
    purpose       text,
    status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ISSUED')),
    requested_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_requisitions ENABLE ROW LEVEL SECURITY;

-- 4. Staff leave ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    staff_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_type   text NOT NULL DEFAULT 'ANNUAL' CHECK (leave_type IN (
        'ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'STUDY', 'OTHER'
    )),
    starts_on    date NOT NULL,
    ends_on      date NOT NULL,
    reason       text,
    cover_notes  text,
    status       text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    decided_by   text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_on >= starts_on)
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 5. Parents linked to their children --------------------------------------
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id      text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_user_id  text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    relationship    text NOT NULL DEFAULT 'GUARDIAN' CHECK (relationship IN ('MOTHER', 'FATHER', 'GUARDIAN', 'SPONSOR', 'OTHER')),
    is_primary      boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, parent_user_id)
);
CREATE INDEX IF NOT EXISTS student_guardians_parent ON public.student_guardians (parent_user_id);
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
