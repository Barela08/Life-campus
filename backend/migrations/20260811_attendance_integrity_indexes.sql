-- Attendance integrity and lookup indexes for LifeOS Smart Campus.
-- Safe to run repeatedly on PostgreSQL. For SQLite/dev, app startup also creates
-- equivalent indexes where supported.

CREATE INDEX IF NOT EXISTS ix_attendance_records_student_id
ON attendance_records (student_id);

CREATE INDEX IF NOT EXISTS ix_attendance_records_session_id
ON attendance_records (session_id);

CREATE INDEX IF NOT EXISTS ix_attendance_records_date
ON attendance_records (date);

CREATE INDEX IF NOT EXISTS ix_attendance_sessions_teacher_id
ON attendance_sessions (teacher_id);

CREATE INDEX IF NOT EXISTS ix_attendance_sessions_subject_id
ON attendance_sessions (subject_id);

CREATE INDEX IF NOT EXISTS ix_attendance_sessions_class_section
ON attendance_sessions (class_id, section);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM attendance_records
    GROUP BY session_id, student_id
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_student
    ON attendance_records (session_id, student_id);
  END IF;
END $$;
