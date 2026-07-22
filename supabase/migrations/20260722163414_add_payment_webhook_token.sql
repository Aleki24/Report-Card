-- Migration: per-school secret token for Daraja webhook URLs
--
-- Safaricom's Daraja callbacks are not cryptographically signed, so the
-- STK Push callback and C2B confirmation endpoints previously accepted
-- any POST that knew a school's UUID — and for STK, the paying user
-- themselves receives the CheckoutRequestID needed to forge a "success"
-- callback for their own pending payment. The token adds an unguessable
-- secret path segment to the URLs we hand Safaricom, so forged requests
-- are rejected before they can touch the fee_payments ledger.
--
-- No backfill: the app generates the token on settings save (and on
-- demand before building any callback URL), and the live table is empty
-- at the time of this migration.

ALTER TABLE school_payment_settings
    ADD COLUMN IF NOT EXISTS webhook_token TEXT;
