-- Fees: reconciliation, controls and follow-ups.
--
-- How Kenyan schools actually keep fees straight: parents pay the Paybill
-- with the admission number as the account, the bursar downloads the M-Pesa
-- (or bank) statement, matches every line to a learner, chases what does not
-- match the same week, and checks the ledger totals equal the statement's.
-- Someone other than the person who recorded the money looks over each day.
-- Arrears are followed up early, with promises written down.
--
-- Server-only, like the rest of fees: RLS on, no policies, reached through
-- the service role. User and student ids are text (Clerk ids).

-- ── Payments ─────────────────────────────────────────────────────────────
-- reference:      the bank slip or cheque number (M-Pesa codes stay in
--                 mpesa_receipt_number), required for non-cash payments.
-- split_from_payment_id: one payment shared between learners (two siblings
--                 paid in one M-Pesa transaction): the original keeps the
--                 code and the first learner's share, each other share is
--                 its own receipt pointing back to it.
-- voided_by/at:   who voided a payment, and when (the reason is in notes).
-- reconciliation_id: the statement import that recorded it.
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS split_from_payment_id uuid REFERENCES public.fee_payments(id) ON DELETE SET NULL;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS voided_by text REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS reconciliation_id uuid;

CREATE INDEX IF NOT EXISTS idx_fee_payments_split_from ON public.fee_payments(split_from_payment_id) WHERE split_from_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_paid_at ON public.fee_payments(school_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_reference ON public.fee_payments(school_id, reference) WHERE reference IS NOT NULL;

-- ── Statement imports ────────────────────────────────────────────────────
-- One row per statement uploaded, and what became of its money in:
-- statement_total = recorded_total + already_total + unmatched_total + skipped_total.
CREATE TABLE IF NOT EXISTS public.fee_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('MPESA', 'BANK')),
    file_name text,
    period_from date,
    period_to date,
    lines integer NOT NULL DEFAULT 0,
    statement_total numeric(14, 2) NOT NULL DEFAULT 0,
    recorded_total numeric(14, 2) NOT NULL DEFAULT 0,
    already_total numeric(14, 2) NOT NULL DEFAULT 0,
    unmatched_total numeric(14, 2) NOT NULL DEFAULT 0,
    skipped_total numeric(14, 2) NOT NULL DEFAULT 0,
    created_by text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fee_reconciliations_school ON public.fee_reconciliations(school_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_reconciliation_id_fkey') THEN
        ALTER TABLE public.fee_payments
            ADD CONSTRAINT fee_payments_reconciliation_id_fkey
            FOREIGN KEY (reconciliation_id) REFERENCES public.fee_reconciliations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ── Daily review ─────────────────────────────────────────────────────────
-- A day's collections looked over by someone, ideally not the person who
-- recorded them. The total and count are what they saw when they signed.
CREATE TABLE IF NOT EXISTS public.fee_day_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    day date NOT NULL,
    total numeric(14, 2) NOT NULL DEFAULT 0,
    payments integer NOT NULL DEFAULT 0,
    note text,
    reviewed_by text REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, day)
);

-- ── Follow-ups on arrears ────────────────────────────────────────────────
-- A call or message (NOTE), or a family's promise to pay an amount by a
-- date (PROMISE). Whether a promise was kept is read from the payments.
CREATE TABLE IF NOT EXISTS public.fee_followups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('NOTE', 'PROMISE')),
    amount numeric(14, 2) CHECK (amount IS NULL OR amount > 0),
    due_date date,
    note text NOT NULL,
    created_by text REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (kind <> 'PROMISE' OR (amount IS NOT NULL AND due_date IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_fee_followups_student ON public.fee_followups(school_id, student_id, created_at DESC);

ALTER TABLE public.fee_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_day_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fee_reconciliations FROM anon, authenticated;
REVOKE ALL ON public.fee_day_reviews FROM anon, authenticated;
REVOKE ALL ON public.fee_followups FROM anon, authenticated;
