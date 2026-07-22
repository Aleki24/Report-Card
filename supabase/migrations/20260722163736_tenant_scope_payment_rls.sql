-- Migration: tenant-scope the payment RLS policies
--
-- The existing policies gated on role alone (get_my_role() = 'ADMIN'
-- etc.), which at the RLS layer would let an admin of ANY school through
-- to another school's rows. Today that's latent — auth is Clerk-based
-- and clients never hold Supabase JWTs, so all access flows through the
-- service-role server code, which does its own school checks — but RLS
-- is exactly the defense-in-depth layer that should still hold if that
-- architecture ever changes. Add the caller's own school_id to every
-- role-gated payment policy.

DROP POLICY IF EXISTS "Admins manage payment settings" ON school_payment_settings;
CREATE POLICY "Admins manage payment settings" ON school_payment_settings FOR ALL USING (
    get_my_role() = 'ADMIN'
    AND school_id = (SELECT school_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Admins and class teachers manage payments" ON fee_payments;
CREATE POLICY "Admins and class teachers manage payments" ON fee_payments FOR ALL USING (
    get_my_role() IN ('ADMIN', 'CLASS_TEACHER')
    AND school_id = (SELECT school_id FROM users WHERE id = auth.uid()::text)
);

DROP POLICY IF EXISTS "Admins manage bank accounts" ON school_bank_accounts;
CREATE POLICY "Admins manage bank accounts" ON school_bank_accounts FOR ALL USING (
    get_my_role() = 'ADMIN'
    AND school_id = (SELECT school_id FROM users WHERE id = auth.uid()::text)
);
