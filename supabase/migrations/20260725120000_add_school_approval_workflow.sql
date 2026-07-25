-- School sign-ups need platform-owner approval before the school goes live.
--
-- Previously anyone who signed up could name a school, was immediately promoted
-- to ADMIN of it, and started using the system with no notification to the
-- platform owner. A school now starts life as PENDING_APPROVAL: the requester
-- keeps the PENDING role (so every existing role check already denies them
-- school data) until the owner approves, which is what promotes them to ADMIN.

ALTER TABLE schools ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approval_decided_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approval_note TEXT;
-- Single-use secret embedded in the owner's approve/reject links, cleared once
-- a decision is recorded. Avoids needing a separate owner login to act.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS approval_token TEXT;
-- The account that asked for the school, promoted to ADMIN on approval.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS requested_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Grandfather every school that already exists: they are live customers and
-- must not be locked out by this change. Only rows created from here on start
-- as PENDING_APPROVAL.
UPDATE schools
   SET approval_status = 'APPROVED',
       approval_decided_at = COALESCE(approval_decided_at, created_at)
 WHERE approval_status <> 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_schools_approval_status ON schools(approval_status);
