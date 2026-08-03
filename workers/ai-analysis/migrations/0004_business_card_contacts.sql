CREATE TABLE IF NOT EXISTS business_card_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  organization TEXT DEFAULT '',
  title TEXT DEFAULT '',
  context_note TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'direct',
  mode TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  follow_up_at TEXT,
  owner_note TEXT DEFAULT '',
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  ip_hash TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_card_contacts_created
  ON business_card_contacts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_card_contacts_status_follow_up
  ON business_card_contacts (status, follow_up_at);

CREATE INDEX IF NOT EXISTS idx_business_card_contacts_ip_created
  ON business_card_contacts (ip_hash, created_at);
