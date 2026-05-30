CREATE TABLE IF NOT EXISTS members (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  school_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  requested_role TEXT NOT NULL DEFAULT 'general',
  role TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_members_status_updated
  ON members (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_members_role_status
  ON members (role, status);

CREATE TABLE IF NOT EXISTS member_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_uid TEXT NOT NULL,
  target_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_audit_logs_target
  ON member_audit_logs (target_uid, created_at);

CREATE TABLE IF NOT EXISTS member_invitations (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'approved',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  accepted_uid TEXT,
  accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_invitations_status
  ON member_invitations (status, created_at);
