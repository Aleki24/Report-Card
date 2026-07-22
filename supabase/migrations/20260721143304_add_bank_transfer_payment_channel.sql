-- Migration: Add direct bank transfer as an independent payment channel
--
-- Daraja and Pesapal are both automated gateways doing the same job (a
-- student taps "Pay" and the STK/checkout flow runs), so a school picks
-- one at a time via active_provider. Bank transfer is different: it's
-- always a manual deposit the bursar reconciles by hand against a bank
-- statement, so it can be switched on alongside whichever automated
-- provider (or neither) a school uses, rather than competing for the
-- same active_provider slot.
--
-- bank_enabled just toggles whether bank pay-in instructions show on the
-- student fees page. school_bank_accounts holds the actual account
-- details a school wants parents to deposit into — a school may list more
-- than one account (e.g. two different banks), so this is its own table
-- rather than more columns on school_payment_settings.

ALTER TABLE school_payment_settings
    ADD COLUMN IF NOT EXISTS bank_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS school_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    branch TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_school_bank_accounts_school_id ON school_bank_accounts(school_id);

ALTER TABLE school_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage bank accounts" ON school_bank_accounts;
CREATE POLICY "Admins manage bank accounts" ON school_bank_accounts FOR ALL USING (get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Users view their school's bank accounts" ON school_bank_accounts;
CREATE POLICY "Users view their school's bank accounts" ON school_bank_accounts FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid()::text)
);
