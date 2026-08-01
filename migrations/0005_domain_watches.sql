PRAGMA foreign_keys = ON;

CREATE TABLE domain_watches (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  record_key TEXT NOT NULL,
  query_name TEXT NOT NULL,
  query_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  purge_at TEXT NOT NULL,
  next_sample_at TEXT NOT NULL,
  last_sample_at TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  change_count INTEGER NOT NULL DEFAULT 0,
  current_state TEXT,
  current_fingerprint TEXT
);

CREATE TABLE domain_watch_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id TEXT NOT NULL,
  sampled_at TEXT NOT NULL,
  state TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  changed INTEGER NOT NULL DEFAULT 0 CHECK (changed IN (0, 1)),
  cloudflare_json TEXT NOT NULL,
  google_json TEXT NOT NULL,
  FOREIGN KEY (watch_id) REFERENCES domain_watches(id) ON DELETE CASCADE
);

CREATE INDEX idx_domain_watches_due ON domain_watches(status, next_sample_at);
CREATE INDEX idx_domain_watches_purge ON domain_watches(purge_at);
CREATE INDEX idx_domain_watch_samples_watch ON domain_watch_samples(watch_id, id);
