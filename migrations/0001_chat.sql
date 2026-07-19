PRAGMA foreign_keys = ON;

CREATE TABLE conversations (
  public_number INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_token_hash TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT,
  visitor_phone TEXT,
  visitor_timezone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'callback_pending', 'contacted', 'closed', 'spam')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_visitor_message_at TEXT,
  last_owner_message_at TEXT,
  closed_at TEXT,
  user_agent_summary TEXT,
  ip_hash TEXT
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'owner', 'system')),
  message_text TEXT NOT NULL,
  client_message_id TEXT,
  telegram_message_id INTEGER,
  telegram_notified_at TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  read_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE (conversation_id, sender_type, client_message_id),
  UNIQUE (sender_type, telegram_message_id)
);

CREATE TABLE callback_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_original TEXT NOT NULL,
  phone_normalized TEXT,
  email TEXT,
  reason TEXT NOT NULL,
  preferred_callback_at TEXT,
  visitor_timezone TEXT,
  consent_given INTEGER NOT NULL CHECK (consent_given IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'callback_pending'
    CHECK (status IN ('callback_pending', 'contacted', 'closed', 'spam')),
  created_at TEXT NOT NULL,
  contacted_at TEXT,
  telegram_notified_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE telegram_message_map (
  telegram_chat_id TEXT NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  conversation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (telegram_chat_id, telegram_message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE telegram_updates (
  update_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE telegram_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('message', 'callback')),
  source_id INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  last_error_code TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  UNIQUE (source_type, source_id)
);

CREATE TABLE rate_limit_windows (
  rate_key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (rate_key, action, window_started_at)
);

CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, id);
CREATE INDEX idx_callbacks_status ON callback_requests(status, created_at DESC);
CREATE INDEX idx_callbacks_conversation ON callback_requests(conversation_id, created_at DESC);
CREATE INDEX idx_telegram_map_conversation ON telegram_message_map(conversation_id);
CREATE INDEX idx_outbox_due ON telegram_outbox(delivered_at, next_attempt_at);
CREATE INDEX idx_rate_limits_expiry ON rate_limit_windows(expires_at);

