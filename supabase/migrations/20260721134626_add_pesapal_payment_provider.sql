-- Migration: Add Pesapal as a second payment provider alongside M-Pesa Daraja
--
-- school_payment_settings previously only held Daraja credentials with a
-- single is_active flag. Schools can now instead (or additionally, later)
-- collect fees via Pesapal's hosted checkout, which supports M-Pesa, cards,
-- and other rails through one integration. active_provider replaces
-- is_active as the single source of truth for which gateway (if any) shows
-- up as "Pay" for students — a school picks one at a time to avoid two
-- competing payment buttons.
--
-- fee_payments gains a PESAPAL method plus Pesapal's own tracking columns
-- (order_tracking_id, merchant_reference, confirmation_code, and the
-- underlying rail Pesapal reports e.g. "MPESA"/"VISA"), mirroring the
-- mpesa_* columns already used for the Daraja STK Push flow.

ALTER TABLE school_payment_settings
    ADD COLUMN IF NOT EXISTS active_provider TEXT NOT NULL DEFAULT 'NONE' CHECK (active_provider IN ('NONE', 'DARAJA', 'PESAPAL')),
    ADD COLUMN IF NOT EXISTS pesapal_environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (pesapal_environment IN ('sandbox', 'live')),
    ADD COLUMN IF NOT EXISTS pesapal_consumer_key TEXT,
    ADD COLUMN IF NOT EXISTS pesapal_consumer_secret TEXT,
    ADD COLUMN IF NOT EXISTS pesapal_ipn_id TEXT;

-- Backfill: schools that already had Daraja switched on keep working the
-- same way under the new column instead of silently losing their setup.
UPDATE school_payment_settings SET active_provider = 'DARAJA' WHERE is_active = true AND active_provider = 'NONE';

DO $$ BEGIN
    ALTER TYPE fee_payment_method ADD VALUE IF NOT EXISTS 'PESAPAL';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE fee_payments
    ADD COLUMN IF NOT EXISTS pesapal_order_tracking_id TEXT,
    ADD COLUMN IF NOT EXISTS pesapal_merchant_reference TEXT,
    ADD COLUMN IF NOT EXISTS pesapal_confirmation_code TEXT,
    ADD COLUMN IF NOT EXISTS pesapal_payment_method TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_pesapal_order_tracking ON fee_payments(pesapal_order_tracking_id) WHERE pesapal_order_tracking_id IS NOT NULL;
