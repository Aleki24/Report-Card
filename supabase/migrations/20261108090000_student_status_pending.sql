-- Learners left pending by a promotion: Grade 9s until Senior School
-- placement is out, or a top class waiting for the school to add its next
-- grade. They keep their class and records but are off the roll: class
-- lists, attendance, invoices and SMS read ACTIVE learners only.
--
-- Its own migration: an enum value can't be used in the transaction that
-- adds it, and 20261108090100_promotion_pending.sql uses it.
ALTER TYPE public.student_status ADD VALUE IF NOT EXISTS 'PENDING';
