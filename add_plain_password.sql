ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;
UPDATE users SET plain_password = 'password123' WHERE plain_password IS NULL;
