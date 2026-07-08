CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  author_uid TEXT NOT NULL,
  author_email TEXT DEFAULT '',
  author_name TEXT DEFAULT '',
  anonymous_name TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT DEFAULT '',
  admin_uid TEXT DEFAULT '',
  admin_replied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consultations_author_room_updated
  ON consultations (author_uid, room, updated_at);

CREATE INDEX IF NOT EXISTS idx_consultations_room_status_updated
  ON consultations (room, status, updated_at);
