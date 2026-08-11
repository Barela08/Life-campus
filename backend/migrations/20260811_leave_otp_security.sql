-- Apply in Supabase SQL editor before deploying the leave and OTP flow.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS applicant_id bigint REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS applicant_role text NOT NULL DEFAULT 'student';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'general';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS from_date date;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS to_date date;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachment_url text NOT NULL DEFAULT '';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by bigint REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason text NOT NULL DEFAULT '';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS leave_requests_applicant_created_idx ON leave_requests(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_requests_review_queue_idx ON leave_requests(status, applicant_role, created_at DESC);

ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS otp_hash text NOT NULL DEFAULT '';
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS verified_at timestamptz;
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_active_idx ON password_reset_tokens(user_id, used, expires_at DESC);
