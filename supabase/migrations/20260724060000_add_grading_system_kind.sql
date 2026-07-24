-- Distinguishes a subject grading system (mark % -> grade + points) from an
-- overall grading system (total points -> mean/overall grade).
--
-- SUBJECT systems: min_percentage/max_percentage are percentage bands; each
--   band carries a grade symbol and the points that grade is worth.
-- OVERALL systems: min_percentage/max_percentage hold TOTAL POINTS bounds; the
--   summed 8-4-4 points of a student's best subjects are looked up here to
--   produce the overall/mean grade.
--
-- Existing rows default to SUBJECT so nothing changes for current data.
ALTER TABLE grading_systems ADD COLUMN IF NOT EXISTS system_kind TEXT NOT NULL DEFAULT 'SUBJECT'
    CHECK (system_kind IN ('SUBJECT', 'OVERALL'));
