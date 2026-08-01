CREATE TABLE IF NOT EXISTS ots_secrets (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  claim_token_hash TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('owner', 'trial')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'consumed')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 16384),
  creator_ip_hash TEXT,
  creator_identity_hash TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_ots_secrets_expiry ON ots_secrets (expires_at);
CREATE INDEX IF NOT EXISTS idx_ots_secrets_consumed ON ots_secrets (consumed_at) WHERE consumed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS ots_rate_limit_windows (
  subject_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (subject_hash, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ots_rate_limit_expiry ON ots_rate_limit_windows (expires_at);
