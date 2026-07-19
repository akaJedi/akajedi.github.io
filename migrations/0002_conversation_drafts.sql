PRAGMA foreign_keys = ON;

CREATE TABLE conversation_drafts (
  conversation_id TEXT PRIMARY KEY,
  message_text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
