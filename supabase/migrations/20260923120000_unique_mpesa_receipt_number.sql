-- One ledger row per M-Pesa transaction.
--
-- mpesa_receipt_number holds Safaricom's transaction id (TransID on a
-- Paybill/C2B confirmation, MpesaReceiptNumber on an STK callback, or the
-- code a bursar types when recording an M-Pesa payment by hand). Nothing
-- stopped the same transaction landing twice: Safaricom re-sends a C2B
-- confirmation it thinks went unanswered, and a bursar can record by hand a
-- payment that the Paybill already recorded. Every copy was COMPLETED, and
-- sync_student_fee_totals() counted each one, so a single payment could
-- clear a fee two or three times over.
--
-- The C2B route now checks for an existing row first; this index is what
-- makes that hold under concurrent deliveries and for every other writer.
--
-- Scoped to the school: transaction ids are global, but a row is only
-- ever this school's claim on one, and a global index would let one school
-- block another school from recording its own payment.
--
-- Voided rows (CANCELLED) are left out so a payment that was voided by
-- mistake can be recorded again; rows without a receipt (cash, bank, a
-- still-PENDING STK push) are left out because there is nothing to compare.
--
-- Checked before writing: production had no rows with a receipt number, so
-- there were no duplicates for this to trip over.

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_school_mpesa_receipt
    ON fee_payments (school_id, mpesa_receipt_number)
    WHERE mpesa_receipt_number IS NOT NULL AND status <> 'CANCELLED';
