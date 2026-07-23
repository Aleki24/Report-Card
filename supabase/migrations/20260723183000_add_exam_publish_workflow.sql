-- Exam results workflow: teachers enter marks (DRAFT), publish for review
-- (PENDING_APPROVAL), an admin approves (APPROVED) before class teachers and
-- other authorized staff can download report cards / result exports.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS published_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
