import * as Sentry from "@sentry/cloudflare";
import {
  AVAILABLE_MESSAGE,
  PublicError,
  QUIET_MESSAGE,
  availability,
  base64url,
  constantTimeEqual,
  corsHeaders,
  createChallenge,
  getAllowedOrigins,
  hashValue,
  isAllowedOrigin,
  json,
  normalizePhone,
  optionalString,
  readJson,
  requiredString,
  safeLog,
  validateEmail,
  validateTimezone,
  verifyChallenge,
  verifyTurnstile,
} from "./lib";
import { flushOutbox, processTelegramUpdate, queueNotification } from "./telegram";
import type { ConversationRow, Env, MessageRow } from "./types";

const OPEN_STATUSES = new Set(["pending", "active", "callback_pending", "contacted"]);

function secret(env: Env): string {
  if (!env.SESSION_HASH_SECRET) throw new PublicError(503, "Service temporarily unavailable.", "session_secret_missing");
  return env.SESSION_HASH_SECRET;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, String(value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function getIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function userAgentSummary(request: Request): string | null {
  const value = request.headers.get("User-Agent")?.replace(/[\r\n]/g, " ").trim();
  return value ? value.slice(0, 200) : null;
}

async function rateLimit(
  env: Env,
  identity: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expires = windowStart + windowSeconds * 2;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limit_windows
       (rate_key, action, window_started_at, request_count, expires_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(rate_key, action, window_started_at)
     DO UPDATE SET request_count = request_count + 1
     RETURNING request_count`,
  )
    .bind(identity, action, windowStart, expires)
    .first<{ request_count: number }>();
  if (!row || row.request_count > limit) {
    throw new PublicError(429, "Too many requests. Please try again later.", `rate_${action}`);
  }
}

async function rateLimitIp(
  request: Request,
  env: Env,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const ipHash = await hashValue(secret(env), "ip", getIp(request));
  await rateLimit(env, ipHash, action, limit, windowSeconds);
}

async function authenticate(request: Request, env: Env): Promise<ConversationRow> {
  const id = request.headers.get("X-Conversation-ID") || "";
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!id || !token || !token.startsWith(`${id}.`)) {
    throw new PublicError(401, "Conversation authentication failed.", "auth_missing");
  }
  const conversation = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?")
    .bind(id)
    .first<ConversationRow>();
  const candidate = await hashValue(secret(env), "session", token);
  if (!conversation || !constantTimeEqual(candidate, conversation.session_token_hash)) {
    throw new PublicError(401, "Conversation authentication failed.", "auth_invalid");
  }
  await rateLimit(env, await hashValue(secret(env), "conversation", id), "conversation", 120, 60);
  return conversation;
}

async function handleAvailability(request: Request, env: Env): Promise<Response> {
  await rateLimitIp(request, env, "availability", 60, 60);
  return json({ ...availability(env), submissionToken: await createChallenge(secret(env)) });
}

async function handleStart(request: Request, env: Env): Promise<Response> {
  await rateLimitIp(request, env, "start", 5, 10 * 60);
  const body = await readJson(request);
  if (body.website) return json({ success: true }, 200);
  await verifyChallenge(secret(env), body.submissionToken);
  await verifyTurnstile(
    env,
    body.turnstileToken,
    getIp(request),
    body.turnstileIdempotencyKey,
  );
  const name = requiredString(body.name, "name", 100);
  const email = validateEmail(optionalString(body.email, "email", 254));
  const phone = optionalString(body.phone, "phone", 50);
  const message = requiredString(body.message, "message", 4000);
  const timezone = validateTimezone(optionalString(body.timezone, "timezone", 64));
  const clientMessageId = optionalString(body.clientMessageId, "message", 80) || crypto.randomUUID();
  const id = crypto.randomUUID();
  const token = `${id}.${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const tokenHash = await hashValue(secret(env), "session", token);
  const ipHash = await hashValue(secret(env), "ip", getIp(request));
  const now = new Date().toISOString();
  const currentAvailability = availability(env);
  const locale = body.locale === "ru" ? "ru" : "en";
  const systemText = locale === "ru"
    ? (currentAvailability.available
      ? "Сообщения открыты. Денис ответит здесь, когда сможет."
      : "Спасибо за обращение. Сейчас я недоступен с 23:00 до 6:00 по времени Лос-Анджелеса. Оставьте сообщение и контактные данные — я отвечу или перезвоню при первой возможности.")
    : (currentAvailability.available ? AVAILABLE_MESSAGE : QUIET_MESSAGE);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO conversations
         (id, session_token_hash, visitor_name, visitor_email, visitor_phone,
          visitor_timezone, status, created_at, updated_at, last_visitor_message_at,
          user_agent_summary, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    ).bind(id, tokenHash, name, email, phone, timezone, now, now, now, userAgentSummary(request), ipHash),
    env.DB.prepare(
      `INSERT INTO messages (conversation_id, sender_type, message_text, created_at)
       VALUES (?, 'system', ?, ?)`,
    ).bind(id, systemText, now),
    env.DB.prepare(
      `INSERT INTO messages
         (conversation_id, sender_type, message_text, client_message_id, created_at)
       VALUES (?, 'visitor', ?, ?, ?)`,
    ).bind(id, message, clientMessageId, now),
  ]);
  const conversation = await env.DB.prepare("SELECT public_number FROM conversations WHERE id = ?")
    .bind(id)
    .first<{ public_number: number }>();
  const visitorMessage = await env.DB.prepare(
    "SELECT id FROM messages WHERE conversation_id = ? AND sender_type = 'visitor' AND client_message_id = ?",
  )
    .bind(id, clientMessageId)
    .first<{ id: number }>();
  if (!conversation || !visitorMessage) throw new Error("conversation_insert_incomplete");
  await queueNotification(env, id, "message", visitorMessage.id);
  return json(
    {
      success: true,
      conversationId: id,
      publicNumber: conversation.public_number,
      sessionToken: token,
      status: "pending",
      availability: currentAvailability,
      messages: [
        { id: visitorMessage.id - 1, senderType: "system", messageText: systemText, createdAt: now },
        { id: visitorMessage.id, senderType: "visitor", messageText: message, createdAt: now },
      ],
      cursor: visitorMessage.id,
    },
    201,
  );
}

async function handleMessage(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  if (!OPEN_STATUSES.has(conversation.status)) {
    throw new PublicError(409, "This conversation is closed.", "conversation_closed");
  }
  const body = await readJson(request);
  if (body.website) return json({ success: true });
  const message = requiredString(body.message, "message", 4000);
  const clientMessageId = requiredString(body.clientMessageId, "message", 80);
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO messages
       (conversation_id, sender_type, message_text, client_message_id, created_at)
     VALUES (?, 'visitor', ?, ?, ?)
     RETURNING id`,
  )
    .bind(conversation.id, message, clientMessageId, now)
    .first<{ id: number }>();
  const existing =
    inserted ||
    (await env.DB.prepare(
      `SELECT id FROM messages
        WHERE conversation_id = ? AND sender_type = 'visitor' AND client_message_id = ?`,
    )
      .bind(conversation.id, clientMessageId)
      .first<{ id: number }>());
  if (!existing) throw new Error("message_insert_failed");
  await env.DB.prepare("DELETE FROM conversation_drafts WHERE conversation_id = ?")
    .bind(conversation.id)
    .run();
  if (inserted) {
    await env.DB.prepare(
      `UPDATE conversations SET updated_at = ?, last_visitor_message_at = ? WHERE id = ?`,
    )
      .bind(now, now, conversation.id)
      .run();
    await queueNotification(env, conversation.id, "message", existing.id);
  }
  return json({ success: true, messageId: existing.id, createdAt: now });
}

async function handleDraft(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  await rateLimit(
    env,
    await hashValue(secret(env), "draft", conversation.id),
    "draft",
    60,
    60,
  );

  if (request.method === "GET") {
    if (!OPEN_STATUSES.has(conversation.status)) {
      await env.DB.prepare("DELETE FROM conversation_drafts WHERE conversation_id = ?")
        .bind(conversation.id)
        .run();
      return json({ message: "", updatedAt: null });
    }
    const draft = await env.DB.prepare(
      "SELECT message_text, updated_at FROM conversation_drafts WHERE conversation_id = ?",
    )
      .bind(conversation.id)
      .first<{ message_text: string; updated_at: string }>();
    return json({
      message: draft?.message_text || "",
      updatedAt: draft?.updated_at || null,
    });
  }

  if (!OPEN_STATUSES.has(conversation.status)) {
    throw new PublicError(409, "This conversation is closed.", "conversation_closed");
  }
  const body = await readJson(request);
  const message = optionalString(body.message, "message", 4000) || "";
  if (!message) {
    await env.DB.prepare("DELETE FROM conversation_drafts WHERE conversation_id = ?")
      .bind(conversation.id)
      .run();
    return json({ success: true, saved: false, updatedAt: null });
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO conversation_drafts (conversation_id, message_text, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(conversation_id)
     DO UPDATE SET message_text = excluded.message_text, updated_at = excluded.updated_at`,
  )
    .bind(conversation.id, message, now)
    .run();
  return json({ success: true, saved: true, updatedAt: now });
}

async function handleMessages(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  const after = Number(new URL(request.url).searchParams.get("after") || "0");
  if (!Number.isSafeInteger(after) || after < 0) {
    throw new PublicError(400, "Invalid message cursor.", "invalid_cursor");
  }
  const result = await env.DB.prepare(
    `SELECT id, conversation_id, sender_type, message_text, created_at
       FROM messages WHERE conversation_id = ? AND id > ?
      ORDER BY id LIMIT 100`,
  )
    .bind(conversation.id, after)
    .all<MessageRow>();
  const messages = result.results.map((row) => ({
    id: row.id,
    senderType: row.sender_type,
    messageText: row.message_text,
    createdAt: row.created_at,
  }));
  const cursor = messages.length ? messages[messages.length - 1].id : after;
  if (conversation.status === "closed" || conversation.status === "spam") {
    await env.DB.prepare("DELETE FROM conversation_drafts WHERE conversation_id = ?")
      .bind(conversation.id)
      .run();
  }
  const followUpSuggested =
    Date.now() - new Date(conversation.created_at).getTime() >= 5 * 60 * 1000 &&
    !conversation.last_owner_message_at &&
    conversation.status === "pending";
  return json({ messages, cursor, status: conversation.status, followUpSuggested, availability: availability(env) });
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  if (!OPEN_STATUSES.has(conversation.status)) {
    throw new PublicError(409, "This conversation is closed.", "conversation_closed");
  }
  await rateLimit(env, await hashValue(secret(env), "callback", conversation.id), "callback", 3, 60 * 60);
  const body = await readJson(request);
  if (body.website) return json({ success: true });
  const name = requiredString(body.name, "name", 100);
  const phone = requiredString(body.phone, "phone", 50);
  const email = validateEmail(optionalString(body.email, "email", 254));
  const reason = requiredString(body.reason, "reason", 2000);
  const timezone = validateTimezone(optionalString(body.timezone, "timezone", 64));
  const preferred = optionalString(body.preferredCallbackAt, "preferred callback time", 64);
  if (preferred && Number.isNaN(Date.parse(preferred))) {
    throw new PublicError(400, "Please check the preferred callback time.", "invalid_callback_time");
  }
  if (body.consent !== true) {
    throw new PublicError(400, "Consent is required for a callback.", "consent_required");
  }
  const now = new Date().toISOString();
  const callback = await env.DB.prepare(
    `INSERT INTO callback_requests
       (conversation_id, name, phone_original, phone_normalized, email, reason,
        preferred_callback_at, visitor_timezone, consent_given, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'callback_pending', ?)
     RETURNING id`,
  )
    .bind(
      conversation.id,
      name,
      phone,
      normalizePhone(phone),
      email,
      reason,
      preferred ? new Date(preferred).toISOString() : null,
      timezone,
      now,
    )
    .first<{ id: number }>();
  if (!callback) throw new Error("callback_insert_failed");
  await env.DB.prepare(
    `UPDATE conversations
        SET status = 'callback_pending', visitor_name = ?, visitor_phone = ?,
            visitor_email = COALESCE(?, visitor_email), visitor_timezone = COALESCE(?, visitor_timezone),
            updated_at = ? WHERE id = ?`,
  )
    .bind(name, phone, email, timezone, now, conversation.id)
    .run();
  await queueNotification(env, conversation.id, "callback", callback.id);
  return json({
    success: true,
    callbackId: callback.id,
    status: "callback_pending",
    message:
      "Your callback request has been saved. If I’m unable to respond now, I’ll use the contact information you provided to follow up.",
  });
}

async function handleContactUpdate(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  const body = await readJson(request);
  if (body.website) return json({ success: true });
  const email = validateEmail(optionalString(body.email, "email", 254));
  const phone = optionalString(body.phone, "phone", 50);
  if (!email && !phone) {
    throw new PublicError(400, "Please provide a phone number or email address.", "contact_required");
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE conversations SET visitor_email = COALESCE(?, visitor_email),
       visitor_phone = COALESCE(?, visitor_phone), updated_at = ? WHERE id = ?`,
  )
    .bind(email, phone, now, conversation.id)
    .run();
  const note = await env.DB.prepare(
    `INSERT INTO messages (conversation_id, sender_type, message_text, created_at)
     VALUES (?, 'visitor', ?, ?) RETURNING id`,
  )
    .bind(conversation.id, "I added contact information for follow-up.", now)
    .first<{ id: number }>();
  if (note) await queueNotification(env, conversation.id, "message", note.id);
  return json({ success: true });
}

async function handleClose(request: Request, env: Env): Promise<Response> {
  const conversation = await authenticate(request, env);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE conversations SET status = 'closed', updated_at = ?, closed_at = ? WHERE id = ?",
    ).bind(now, now, conversation.id),
    env.DB.prepare(
      "DELETE FROM conversation_drafts WHERE conversation_id = ?",
    ).bind(conversation.id),
  ]);
  return json({ success: true, status: "closed" });
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const configured = env.TELEGRAM_WEBHOOK_SECRET || "";
  const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!configured || !constantTimeEqual(configured, provided)) return json({ ok: false }, 401);
  const update = await readJson(request);
  const updateId = Number(update.update_id);
  if (!Number.isSafeInteger(updateId)) return json({ ok: false }, 400);
  const now = new Date().toISOString();
  const claim = await env.DB.prepare(
    `INSERT OR IGNORE INTO telegram_updates (update_id, status, created_at)
     VALUES (?, 'processing', ?) RETURNING update_id`,
  )
    .bind(updateId, now)
    .first<{ update_id: number }>();
  if (!claim) return json({ ok: true, duplicate: true });
  try {
    await processTelegramUpdate(env, update);
    await env.DB.prepare(
      "UPDATE telegram_updates SET status = 'complete', completed_at = ? WHERE update_id = ?",
    )
      .bind(new Date().toISOString(), updateId)
      .run();
    return json({ ok: true });
  } catch (error) {
    await env.DB.prepare("DELETE FROM telegram_updates WHERE update_id = ? AND status = 'processing'")
      .bind(updateId)
      .run();
    throw error;
  }
}

async function handleHealth(env: Env): Promise<Response> {
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: true, service: "website-chat" });
  } catch {
    return json({ ok: false, service: "website-chat" }, 503);
  }
}

interface TelegramWebhookInfo {
  ok?: boolean;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
}

function isLocalDiagnosticRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function handleDevStatus(request: Request, env: Env): Promise<Response> {
  if (!isLocalDiagnosticRequest(request)) return json({ error: "Not found." }, 404);

  let databaseOk = false;
  let outboxPending = 0;
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    const outbox = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM telegram_outbox WHERE delivered_at IS NULL",
    ).first<{ count: number }>();
    databaseOk = true;
    outboxPending = Number(outbox?.count || 0);
  } catch {}

  const token = env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN || "";
  const configured = Boolean(
    token
      && (env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID)
      && env.TELEGRAM_WEBHOOK_SECRET,
  );
  let webhookSet = false;
  let webhookHost = "";
  let pendingUpdates = 0;
  let lastError = configured ? "Telegram status check failed." : "Telegram secrets are incomplete.";

  if (configured) {
    try {
      const telegramResponse = await fetch(
        "https://api.telegram.org/bot" + token + "/getWebhookInfo",
        { headers: { Accept: "application/json" } },
      );
      const info = await telegramResponse.json<TelegramWebhookInfo>();
      const webhookUrl = info.result?.url || "";
      webhookSet = Boolean(telegramResponse.ok && info.ok && webhookUrl);
      pendingUpdates = Number(info.result?.pending_update_count || 0);
      lastError = info.result?.last_error_message || "";
      if (webhookUrl) {
        try { webhookHost = new URL(webhookUrl).host; } catch {}
      }
    } catch {}
  }

  return json({
    ok: databaseOk,
    database: { ok: databaseOk },
    telegram: {
      configured,
      webhookSet,
      webhookHost,
      pendingUpdates,
      outboxPending,
      healthy: configured && webhookSet && !lastError && outboxPending === 0,
      lastError,
    },
  });
}

async function handleLegacyContact(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("Content-Type") || "";
  let body: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    body = await readJson(request);
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 16 * 1024) {
      throw new PublicError(413, "Request is too large.", "legacy_body_large");
    }
    const params = new URLSearchParams(text);
    body = {};
    params.forEach((value, key) => { body[key] = value; });
  } else {
    throw new PublicError(415, "Unsupported request.", "legacy_content_type");
  }
  if (body.secret_field) return json({ success: true });
  await rateLimitIp(request, env, "legacy_contact", 5, 10 * 60);
  const name = requiredString(body.name, "name", 100);
  const email = validateEmail(requiredString(body.email, "email", 254));
  const phone = optionalString(body.phone, "phone", 50);
  const message = requiredString(body.message, "message", 4000);
  const referer = request.headers.get("Referer") || "";
  let sourcePage: string | null = null;
  try {
    const url = new URL(referer);
    if (getAllowedOrigins(env).has(url.origin)) sourcePage = url.pathname.slice(0, 300);
  } catch {}

  const id = crypto.randomUUID();
  const discardedToken = id + "." + base64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await hashValue(secret(env), "session", discardedToken);
  const ipHash = await hashValue(secret(env), "ip", getIp(request));
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO conversations
         (id, session_token_hash, visitor_name, visitor_email, visitor_phone,
          status, source_type, source_page, created_at, updated_at,
          last_visitor_message_at, user_agent_summary, ip_hash)
       VALUES (?, ?, ?, ?, ?, 'pending', 'contact_form', ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, tokenHash, name, email, phone, sourcePage, now, now, now,
      userAgentSummary(request), ipHash,
    ),
    env.DB.prepare(
      `INSERT INTO messages (conversation_id, sender_type, message_text, created_at)
       VALUES (?, 'visitor', ?, ?)`,
    ).bind(id, message, now),
  ]);
  const visitorMessage = await env.DB.prepare(
    "SELECT id FROM messages WHERE conversation_id = ? AND sender_type = 'visitor'",
  ).bind(id).first<{ id: number }>();
  if (!visitorMessage) throw new Error("legacy_contact_insert_incomplete");
  await queueNotification(env, id, "message", visitorMessage.id);
  return json({ success: true });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return isAllowedOrigin(request, env)
      ? new Response(null, { status: 204, headers: corsHeaders(request, env) })
      : json({ error: "Origin not allowed." }, 403);
  }
  if (url.pathname === "/api/sentry-test" && request.method === "POST") {
    if ((env.ENVIRONMENT || "production") === "production" || !env.SENTRY_TEST_TOKEN
      || request.headers.get("X-Sentry-Test") !== env.SENTRY_TEST_TOKEN) {
      return json({ error: "Not found." }, 404);
    }
    throw new Error("F12 Sentry Worker integration test");
  }
  if (url.pathname === "/api/health" && request.method === "GET") return handleHealth(env);
  if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
    return handleWebhook(request, env);
  }
  if (url.pathname === "/" && request.method === "POST") {
    if (!isAllowedOrigin(request, env)) throw new PublicError(403, "Request not allowed.", "origin");
    const response = await handleLegacyContact(request, env);
    ctx.waitUntil(flushOutbox(env, 3));
    return withCors(response, request, env);
  }
  if (!url.pathname.startsWith("/api/chat/")) return json({ error: "Not found." }, 404);
  if (!isAllowedOrigin(request, env)) throw new PublicError(403, "Request not allowed.", "origin");

  let response: Response;
  if (url.pathname === "/api/chat/dev-status" && request.method === "GET") {
    response = await handleDevStatus(request, env);
  } else if (url.pathname === "/api/chat/availability" && request.method === "GET") {
    response = await handleAvailability(request, env);
  } else if (url.pathname === "/api/chat/start" && request.method === "POST") {
    response = await handleStart(request, env);
  } else if (url.pathname === "/api/chat/message" && request.method === "POST") {
    response = await handleMessage(request, env);
  } else if (url.pathname === "/api/chat/messages" && request.method === "GET") {
    response = await handleMessages(request, env);
  } else if (
    url.pathname === "/api/chat/draft"
    && (request.method === "GET" || request.method === "PUT")
  ) {
    response = await handleDraft(request, env);
  } else if (url.pathname === "/api/chat/callback" && request.method === "POST") {
    response = await handleCallback(request, env);
  } else if (url.pathname === "/api/chat/contact" && request.method === "POST") {
    response = await handleContactUpdate(request, env);
  } else if (url.pathname === "/api/chat/close" && request.method === "POST") {
    response = await handleClose(request, env);
  } else {
    response = json({ error: "Not found." }, 404);
  }
  ctx.waitUntil(flushOutbox(env, 3));
  return withCors(response, request, env);
}

const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      if (!(error instanceof PublicError)) Sentry.captureException(error);
      const publicError = error instanceof PublicError ? error : null;
      safeLog(publicError?.code || "unhandled", { path: new URL(request.url).pathname });
      const response = json(
        { error: publicError?.message || "Something went wrong. Please try again." },
        publicError?.status || 500,
      );
      const path = new URL(request.url).pathname;
      return path.startsWith("/api/chat/") || path === "/" ? withCors(response, request, env) : response;
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      await flushOutbox(env, 25);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM rate_limit_windows WHERE expires_at < ?").bind(nowSeconds),
        env.DB.prepare("DELETE FROM telegram_updates WHERE completed_at IS NOT NULL AND completed_at < ?").bind(thirtyDaysAgo),
        env.DB.prepare("DELETE FROM telegram_outbox WHERE delivered_at IS NOT NULL AND delivered_at < ?").bind(thirtyDaysAgo),
      ]);
    })());
  },
};

export default Sentry.withSentry(
  (sentryEnv) => {
    const env = sentryEnv as unknown as Env;
    return {
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || "production",
      sendDefaultPii: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
      },
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
          const url = event.request.url ? new URL(event.request.url) : null;
          event.tags = {
            ...event.tags,
            component: "chat-worker",
            route: url?.pathname || "unknown",
            method: event.request.method || "unknown",
            environment: env.ENVIRONMENT || "production",
          };
        }
        return event;
      },
    };
  },
  workerHandler as any,
) as typeof workerHandler;
