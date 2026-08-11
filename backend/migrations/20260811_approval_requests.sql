-- Run against PostgreSQL before deploying when automatic schema creation is disabled.
CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  requester_role VARCHAR NOT NULL,
  target_user_id INTEGER NOT NULL REFERENCES users(id),
  request_type VARCHAR NOT NULL DEFAULT 'profile_change',
  requested_changes JSONB NOT NULL,
  old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS ix_approval_requests_requester_id ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS ix_approval_requests_target_user_id ON approval_requests(target_user_id);
CREATE INDEX IF NOT EXISTS ix_approval_requests_reviewed_by ON approval_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS ix_approval_requests_created_at ON approval_requests(created_at);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_request_id INTEGER REFERENCES approval_requests(id);
