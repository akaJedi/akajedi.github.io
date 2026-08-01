ALTER TABLE ots_secrets ADD COLUMN password_protected INTEGER NOT NULL DEFAULT 0 CHECK (password_protected IN (0, 1));
ALTER TABLE ots_secrets ADD COLUMN deletion_reason TEXT NOT NULL DEFAULT 'consumed' CHECK (deletion_reason IN ('consumed', 'expired', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_ots_secrets_owner
  ON ots_secrets (creator_identity_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS ots_secret_receipts (
  id TEXT PRIMARY KEY,
  creator_identity_hash TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finalized_at INTEGER NOT NULL,
  final_status TEXT NOT NULL CHECK (final_status IN ('consumed', 'expired', 'revoked')),
  purge_after INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  password_protected INTEGER NOT NULL DEFAULT 0 CHECK (password_protected IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_ots_receipts_owner
  ON ots_secret_receipts (creator_identity_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ots_receipts_purge
  ON ots_secret_receipts (purge_after);

CREATE TRIGGER IF NOT EXISTS ots_secret_receipt_after_delete
AFTER DELETE ON ots_secrets
BEGIN
  INSERT OR REPLACE INTO ots_secret_receipts (
    id, creator_identity_hash, created_at, expires_at, finalized_at,
    final_status, purge_after, size_bytes, password_protected
  ) VALUES (
    OLD.id,
    OLD.creator_identity_hash,
    OLD.created_at,
    OLD.expires_at,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    OLD.deletion_reason,
    (CAST(strftime('%s', 'now') AS INTEGER) * 1000) + 86400000,
    OLD.size_bytes,
    OLD.password_protected
  );
END;
