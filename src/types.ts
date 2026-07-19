export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  SESSION_HASH_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  // Temporary compatibility aliases for the existing deployed contact form.
  TELEGRAM_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ALLOWED_ORIGIN?: string;
  OWNER_TIMEZONE?: string;
  QUIET_HOURS_START?: string;
  QUIET_HOURS_END?: string;
  CLOSED_RETENTION_DAYS?: string;
  SPAM_RETENTION_DAYS?: string;
  TURNSTILE_REQUIRED?: string;
  TURNSTILE_EXPECTED_HOSTNAMES?: string;
  TURNSTILE_TEST_MODE?: string;
  SENTRY_DSN?: string;
  SENTRY_TEST_KEY?: string;
  SENTRY_TEST_ENABLED?: string;
  SENTRY_SUCCESS_EVENT_SAMPLE_RATE?: string;
  SENTRY_REJECTION_EVENT_SAMPLE_RATE?: string;
  SENTRY_SLOW_REQUEST_MS?: string;
  ENVIRONMENT?: string;
}

export interface Availability {
  available: boolean;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  serverTime: string;
}

export interface ConversationRow {
  id: string;
  public_number: number;
  session_token_hash: string;
  visitor_name: string;
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_timezone: string | null;
  source_type: "chat" | "contact_form";
  source_page: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_owner_message_at: string | null;
}

export interface MessageRow {
  id: number;
  conversation_id: string;
  sender_type: "visitor" | "owner" | "system";
  message_text: string;
  created_at: string;
}

export interface TelegramResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

