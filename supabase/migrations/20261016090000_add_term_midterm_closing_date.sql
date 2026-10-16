-- Report cards and mark sheets print the closing day beside the opening day.
-- At the end of a term that is the term's own end_date; for the mid-term
-- break the school sets it here, as it already sets midterm_reopening_date.
-- Nullable: a term without it prints only the opening day on mid-term reports.
ALTER TABLE terms ADD COLUMN IF NOT EXISTS midterm_closing_date date;
