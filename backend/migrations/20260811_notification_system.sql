-- Run this in the Supabase SQL editor for an existing database before deployment.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_user_id bigint REFERENCES users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_name text NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_requested boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_requested';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_error text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read, created_at DESC);

-- This app authenticates through its FastAPI backend and never exposes a Supabase key to browsers.
-- No browser role receives any direct table policy; all access is enforced by the
-- authenticated FastAPI endpoints, which filter every read/write by user_id.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- If direct PostgREST access is enabled later, replace the deny-by-default setup
-- with policies that map auth users to the application users table:
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "recipients view own notifications" ON notifications FOR SELECT USING (user_id = (auth.jwt() ->> 'app_user_id')::bigint);
-- CREATE POLICY "recipients update own read state" ON notifications FOR UPDATE USING (user_id = (auth.jwt() ->> 'app_user_id')::bigint) WITH CHECK (user_id = (auth.jwt() ->> 'app_user_id')::bigint);

-- Existing system_config is reused for server-only SMTP runtime overrides.
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS updated_by bigint REFERENCES users(id);
