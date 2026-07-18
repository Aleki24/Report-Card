-- Migration: Fix announcements/learning_materials UUID type mismatch
-- Run this in the Supabase SQL Editor
--
-- Same class of bug as the daily_attendance and assignments fixes:
-- announcements.posted_by and learning_materials.created_by were left as
-- uuid, but the app writes Clerk's raw string user IDs into them.
-- Posting an announcement fails with "invalid input syntax for type uuid",
-- and loading announcements fails too because the users!posted_by embed
-- needs a working foreign key, which fix-users-id-type.sql's FK sweep
-- (Phase 2/4) dropped for any column not literally named student_id or
-- user_id — leaving posted_by with no FK at all.

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_posted_by_fkey;
ALTER TABLE public.announcements ALTER COLUMN posted_by TYPE text USING posted_by::text;
ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.learning_materials DROP CONSTRAINT IF EXISTS learning_materials_created_by_fkey;
ALTER TABLE public.learning_materials ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE public.learning_materials
    ADD CONSTRAINT learning_materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- report_cards.generated_by_user_id has no active read/write path in the
-- app today, but it's the same unswept column-name pattern — fixing it now
-- so it isn't the next landmine once report generation tracks its author.
ALTER TABLE public.report_cards DROP CONSTRAINT IF EXISTS report_cards_generated_by_user_id_fkey;
ALTER TABLE public.report_cards ALTER COLUMN generated_by_user_id TYPE text USING generated_by_user_id::text;
ALTER TABLE public.report_cards
    ADD CONSTRAINT report_cards_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
