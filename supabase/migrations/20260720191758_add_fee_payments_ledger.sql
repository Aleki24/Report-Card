-- Migration: Add a per-payment fee ledger and per-school M-Pesa settings
--
-- student_fees previously stored only two running numbers (total_fee,
-- paid_amount) per student per term, with no record of individual
-- transactions — no date, method, receipt number, or trail of who
-- collected what. That's not how school accounting works in practice:
-- every payment (M-Pesa, cash, bank, cheque) needs its own immutable
-- ledger entry with a receipt, and the running balance should be a sum
-- derived from that ledger, not a number typed in by hand.
--
-- fee_payments is that ledger. student_fees.paid_amount/status become
-- derived values, kept in sync by a trigger below so every entry point
-- (manual recording, M-Pesa STK Push, M-Pesa Paybill/C2B confirmation)
-- updates them consistently — no application code path can forget.
--
-- school_payment_settings holds each school's own Safaricom Daraja app
-- credentials (this is a multi-tenant app; each school bills through its
-- own Paybill/Till, so these can't be global environment variables).

CREATE TABLE IF NOT EXISTS school_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL UNIQUE,
    environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    shortcode TEXT,
    passkey TEXT,
    consumer_key TEXT,
    consumer_secret TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

DO $$ BEGIN
    CREATE TYPE fee_payment_method AS ENUM ('MPESA', 'CASH', 'BANK', 'CHEQUE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE fee_payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS fee_receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_receipt_number() RETURNS TEXT AS $$
    SELECT 'RCT-' || LPAD(nextval('fee_receipt_number_seq')::text, 6, '0');
$$ LANGUAGE sql;

CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    -- Nullable: a Paybill/C2B payment whose account number didn't match any
    -- student lands here unassigned, for a human to reconcile.
    student_fee_id UUID REFERENCES student_fees(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL DEFAULT generate_receipt_number() UNIQUE,
    amount NUMERIC(12,2) NOT NULL,
    method fee_payment_method NOT NULL DEFAULT 'CASH',
    status fee_payment_status NOT NULL DEFAULT 'COMPLETED',
    phone_number TEXT,
    payer_name TEXT,
    mpesa_receipt_number TEXT,
    mpesa_checkout_request_id TEXT,
    mpesa_merchant_request_id TEXT,
    -- Raw BillRefNumber from an unmatched M-Pesa C2B confirmation, kept so
    -- staff can reconcile it against the right student later.
    unmatched_account_reference TEXT,
    notes TEXT,
    recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CHECK (student_fee_id IS NOT NULL OR unmatched_account_reference IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee_id ON fee_payments(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON fee_payments(school_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_mpesa_checkout ON fee_payments(mpesa_checkout_request_id) WHERE mpesa_checkout_request_id IS NOT NULL;

-- Keep student_fees.paid_amount/status derived from the ledger, no matter
-- which entry point wrote the payment. Mirrors computeFeeStatus() in
-- src/lib/fees.ts — keep both in sync if that logic ever changes.
CREATE OR REPLACE FUNCTION sync_student_fee_totals() RETURNS TRIGGER AS $$
DECLARE
    v_student_fee_id UUID := COALESCE(NEW.student_fee_id, OLD.student_fee_id);
    v_total NUMERIC(12,2);
    v_paid NUMERIC(12,2);
    v_status TEXT;
BEGIN
    IF v_student_fee_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM fee_payments
    WHERE student_fee_id = v_student_fee_id AND status = 'COMPLETED';

    SELECT total_fee INTO v_total FROM student_fees WHERE id = v_student_fee_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_status := CASE
        WHEN v_total <= 0 THEN (CASE WHEN v_paid > 0 THEN 'OVERPAID' ELSE 'PAID' END)
        WHEN v_paid <= 0 THEN 'PENDING'
        WHEN v_paid > v_total THEN 'OVERPAID'
        WHEN v_paid >= v_total THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE student_fees
    SET paid_amount = v_paid, status = v_status, updated_at = now()
    WHERE id = v_student_fee_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_student_fee_totals ON fee_payments;
CREATE TRIGGER trigger_sync_student_fee_totals
    AFTER INSERT OR UPDATE OF amount, status, student_fee_id OR DELETE ON fee_payments
    FOR EACH ROW EXECUTE FUNCTION sync_student_fee_totals();

-- Backfill: preserve existing aggregate paid_amount values as an opening
-- ledger entry so the trigger above never silently zeroes out real
-- payment history recorded before this migration.
INSERT INTO fee_payments (school_id, student_fee_id, amount, method, status, notes, paid_at)
SELECT school_id, id, paid_amount, 'OTHER', 'COMPLETED', 'Opening balance migrated from legacy paid_amount', updated_at
FROM student_fees
WHERE paid_amount > 0;

ALTER TABLE school_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment settings" ON school_payment_settings FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "Students view their own payments" ON fee_payments FOR SELECT USING (
    student_fee_id IN (SELECT id FROM student_fees WHERE student_id = auth.uid()::text)
);
CREATE POLICY "Admins and class teachers manage payments" ON fee_payments FOR ALL USING (
    get_my_role() IN ('ADMIN', 'CLASS_TEACHER')
);
