CREATE TABLE progress_backups (
  code_digest TEXT PRIMARY KEY NOT NULL CHECK (length(code_digest) = 64),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  completed_lessons TEXT NOT NULL CHECK (
    json_valid(completed_lessons) AND json_type(completed_lessons) = 'array'
    AND json_array_length(completed_lessons) BETWEEN 1 AND 3
  ),
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX progress_expiry ON progress_backups (expires_at);

CREATE TABLE progress_request_limits (
  action TEXT PRIMARY KEY NOT NULL CHECK (action IN ('save', 'restore', 'revoke')),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
) STRICT;
