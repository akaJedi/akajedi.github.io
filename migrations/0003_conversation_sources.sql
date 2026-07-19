PRAGMA foreign_keys = ON;

ALTER TABLE conversations ADD COLUMN source_type TEXT NOT NULL DEFAULT 'chat'
  CHECK (source_type IN ('chat', 'contact_form'));

ALTER TABLE conversations ADD COLUMN source_page TEXT;

CREATE INDEX idx_conversations_source_created
  ON conversations(source_type, created_at DESC);
