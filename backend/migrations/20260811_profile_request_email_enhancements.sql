-- Run against PostgreSQL/Supabase before deployment when automatic schema creation is disabled.
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_approval_requests_requester_role_status
  ON approval_requests(requester_role, status);
