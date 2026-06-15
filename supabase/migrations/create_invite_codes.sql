-- Invite Codes Table for Privacy-First Authentication
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id),
  role VARCHAR(30) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_user ON invite_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_school ON invite_codes(school_id);

-- Allow service role full access
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on invite_codes"
  ON invite_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);
