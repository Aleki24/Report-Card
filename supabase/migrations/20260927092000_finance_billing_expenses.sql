-- Finance: vote heads, fee structures, invoices, bursaries, suppliers and
-- expenses. Additive only; service-role only (RLS on, no policies).
--
-- Invoicing sets student_fees.total_fee (billed minus awards) for the term,
-- so the existing payment ledger, balances, receipts and M-Pesa flows keep
-- working unchanged on top of it.

-- Day scholar or boarder: drives which fee structure applies (and boarding).
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS residence text NOT NULL DEFAULT 'DAY';
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_residence_check;
ALTER TABLE public.students
    ADD CONSTRAINT students_residence_check CHECK (residence IN ('DAY', 'BOARDER'));

CREATE TABLE IF NOT EXISTS public.vote_heads (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name        text NOT NULL,
    code        text,
    -- Payments are allocated to vote heads in ascending priority.
    priority    int NOT NULL DEFAULT 100,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);
ALTER TABLE public.vote_heads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fee_structures (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name              text NOT NULL,
    academic_year_id  uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    grade_id          uuid REFERENCES public.grades(id) ON DELETE CASCADE,
    residence         text NOT NULL DEFAULT 'ALL' CHECK (residence IN ('ALL', 'DAY', 'BOARDER')),
    -- Share of the annual amount billed in each term, in term order (MoE: 50:30:20).
    term_split        numeric[] NOT NULL DEFAULT '{50,30,20}',
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fee_structure_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    structure_id  uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
    vote_head_id  uuid NOT NULL REFERENCES public.vote_heads(id) ON DELETE RESTRICT,
    annual_amount numeric(12,2) NOT NULL CHECK (annual_amount >= 0),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (structure_id, vote_head_id)
);
ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.invoices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id    text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    term_id       uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    structure_id  uuid REFERENCES public.fee_structures(id) ON DELETE SET NULL,
    total         numeric(12,2) NOT NULL DEFAULT 0,
    created_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    -- Re-running a term's billing replaces the invoice instead of doubling it.
    UNIQUE (student_id, term_id)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.invoice_lines (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    invoice_id    uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    vote_head_id  uuid REFERENCES public.vote_heads(id) ON DELETE SET NULL,
    description   text NOT NULL,
    amount        numeric(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice ON public.invoice_lines (invoice_id);
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

-- Bursaries, scholarships, waivers and discounts reduce what a learner owes.
CREATE TABLE IF NOT EXISTS public.fee_awards (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id  text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    term_id     uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
    kind        text NOT NULL DEFAULT 'BURSARY' CHECK (kind IN ('BURSARY', 'SCHOLARSHIP', 'WAIVER', 'DISCOUNT')),
    sponsor     text,
    amount      numeric(12,2) NOT NULL CHECK (amount > 0),
    reference   text,
    notes       text,
    created_by  text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_awards_student_term ON public.fee_awards (student_id, term_id);
ALTER TABLE public.fee_awards ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.suppliers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name        text NOT NULL,
    phone       text,
    email       text,
    kra_pin     text,
    category    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, name)
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- PENDING -> APPROVED | REJECTED; APPROVED -> PAID
CREATE TABLE IF NOT EXISTS public.expenses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    description     text NOT NULL,
    amount          numeric(12,2) NOT NULL CHECK (amount > 0),
    expense_date    date NOT NULL DEFAULT CURRENT_DATE,
    supplier_id     uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    vote_head_id    uuid REFERENCES public.vote_heads(id) ON DELETE SET NULL,
    payment_method  text CHECK (payment_method IN ('CASH', 'BANK', 'MPESA', 'CHEQUE')),
    reference       text,
    status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    requested_by    text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_by      text REFERENCES public.users(id) ON DELETE SET NULL,
    decided_at      timestamptz,
    decision_note   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_school_date ON public.expenses (school_id, expense_date DESC);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
