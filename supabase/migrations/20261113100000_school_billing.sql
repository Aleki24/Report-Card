-- Skulbase billing schools: one invoice a term (or a year), priced by the
-- school's size (src/lib/pricing.ts). A school's first invoice is free.
-- Schools pay by M-Pesa Paybill or bank and the platform owner confirms
-- the payment. An invoice unpaid 14 days after its due date puts the school
-- in read-only until it is paid.
--
-- Server-only: RLS on, no policies, reached through the service role.

CREATE TABLE IF NOT EXISTS public.school_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    -- "Term 1 2027", or "Year from Term 1 2027".
    label text NOT NULL,
    cycle text NOT NULL CHECK (cycle IN ('TERM', 'YEAR')),
    period_start date NOT NULL,
    period_end date NOT NULL CHECK (period_end >= period_start),
    -- Active learners when the invoice was made, and the plan they put it on.
    learners integer NOT NULL DEFAULT 0 CHECK (learners >= 0),
    plan text NOT NULL,
    amount integer NOT NULL CHECK (amount >= 0),
    -- FREE: the first term; DUE: waiting for payment; PAID; VOID: replaced or cancelled.
    status text NOT NULL DEFAULT 'DUE' CHECK (status IN ('FREE', 'DUE', 'PAID', 'VOID')),
    due_date date NOT NULL,
    paid_amount integer CHECK (paid_amount IS NULL OR paid_amount >= 0),
    -- The M-Pesa code or bank reference the payment came with.
    payment_ref text,
    paid_at timestamptz,
    confirmed_by text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- One live invoice per school and start date.
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_invoices_live_period
    ON public.school_invoices(school_id, period_start) WHERE status <> 'VOID';
CREATE INDEX IF NOT EXISTS idx_school_invoices_school ON public.school_invoices(school_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_school_invoices_due ON public.school_invoices(status, due_date);

ALTER TABLE public.school_invoices ENABLE ROW LEVEL SECURITY;

-- Where schools send payment: one row, set by the platform owner.
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    payment_instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
