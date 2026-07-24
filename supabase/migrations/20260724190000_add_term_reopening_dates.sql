-- Report cards print when the school reopens after a break. Until now that
-- line reused the CURRENT term's start_date, which is the day the term began
-- rather than the day learners come back — so the footer was wrong on every
-- report.
--
-- Schools break twice per term, so each term carries two admin-set dates:
--   midterm_reopening_date — reopening after the mid-term break
--   reopening_date         — reopening after this term ends (i.e. next term)
--
-- Both are nullable: a school that hasn't set them keeps working, and the
-- report routes fall back to the next term's start date.
ALTER TABLE terms ADD COLUMN IF NOT EXISTS midterm_reopening_date date;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS reopening_date date;
