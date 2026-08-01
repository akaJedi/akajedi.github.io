PRAGMA foreign_keys = ON;

CREATE TABLE domain_watch_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  watch_id TEXT NOT NULL,
  sample_id INTEGER,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('changed', 'diverged', 'converged', 'completed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  last_error_code TEXT,
  FOREIGN KEY (watch_id) REFERENCES domain_watches(id) ON DELETE CASCADE
);

CREATE INDEX idx_domain_watch_alerts_due
  ON domain_watch_alerts(delivered_at, next_attempt_at);
CREATE INDEX idx_domain_watch_alerts_watch
  ON domain_watch_alerts(watch_id, id);
