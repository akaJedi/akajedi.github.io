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
import { findAndCleanupEligibleConversations } from "./retention";
import { flushOutbox, processTelegramUpdate, queueNotification } from "./telegram";
import type { ConversationRow, Env, MessageRow } from "./types";

const OPEN_STATUSES = new Set(["pending", "active", "callback_pending", "contacted"]);

const SENTRY_SUCCESS_DEFAULT = 0.10;
const SENTRY_REJECTION_DEFAULT = 1;

function sentryRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

function sampleRate(env: Env, success: boolean): number {
  const fallback = success && (env.ENVIRONMENT || "production") === "production"
    ? SENTRY_SUCCESS_DEFAULT
    : success ? 1 : SENTRY_REJECTION_DEFAULT;
  return sentryRate(
    success ? env.SENTRY_SUCCESS_EVENT_SAMPLE_RATE : env.SENTRY_REJECTION_EVENT_SAMPLE_RATE,
    fallback,
  );
}

function shouldSample(rate: number): boolean {
  return Math.random() < rate;
}

function durationBucket(durationMs: number): string {
  if (durationMs < 250) return "under-250ms";
  if (durationMs < 500) return "250-500ms";
  if (durationMs < 1000) return "500ms-1s";
  if (durationMs < 3000) return "1-3s";
  return "over-3s";
}

function routeName(pathname: string): string {
  if (pathname === "/") return "legacy-contact";
  if (pathname === "/api/telegram/webhook") return "telegram-webhook";
  if (pathname === "/api/sentry-test") return "sentry-test";
  if (pathname.startsWith("/api/chat/")) return pathname.slice("/api/chat/".length).replace(/[^a-z-]/g, "").slice(0, 40) || "chat";
  if (pathname === "/api/health") return "health";
  if (pathname === "/api/ip") return "ip";
  if (pathname === "/api/whoami") return "whoami";
  if (pathname === "/api/domain-lookup") return "domain-lookup";
  return "unknown";
}

async function incrementRouteCount(env: Env, route: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO route_daily_counts (date, route, count) VALUES (?, ?, 1)
     ON CONFLICT(date, route) DO UPDATE SET count = count + 1`,
  ).bind(date, route).run();
}

function sentryEvent(
  env: Env,
  message: string,
  level: "info" | "warning" | "error",
  context: Record<string, string | number | boolean>,
  success = false,
): void {
  if (level === "info" && !shouldSample(sampleRate(env, success))) return;
  Sentry.captureMessage(message, {
    level,
    tags: {
      component: "chat-worker",
      ...(typeof context.operation === "string" ? { operation: context.operation } : {}),
      ...(typeof context.result === "string" ? { result: context.result } : {}),
      ...(typeof context.reason === "string" ? { reason: context.reason } : {}),
      ...(typeof context.integration === "string" ? { integration: context.integration } : {}),
      ...(typeof context.statusClass === "string" ? { telegram_status_class: context.statusClass } : {}),
      ...(typeof context.durationBucket === "string" ? { worker_duration_bucket: context.durationBucket } : {}),
    },
    contexts: { operational: context },
  });
}

function breadcrumb(category: string, message: string): void {
  Sentry.addBreadcrumb({ category, message, level: "info" });
}

function requestResponse(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function secret(env: Env): string {
  if (!env.SESSION_HASH_SECRET) throw new PublicError(503, "Service temporarily unavailable.", "session_secret_missing");
  return env.SESSION_HASH_SECRET;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, String(value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// On api.f12.biz the "/api" prefix is redundant with the subdomain itself
// (https://api.f12.biz/ip, not /api/ip). Routes below are all still defined
// under /api/*, unchanged for the workers.dev domain and any other caller,
// so this just rewrites the incoming request before it reaches routing.
function normalizeApiDomainPath(request: Request): Request {
  const url = new URL(request.url);
  if (url.hostname !== "api.f12.biz" || url.pathname === "/" || url.pathname.startsWith("/api/")) {
    return request;
  }
  url.pathname = "/api" + url.pathname;
  return new Request(url.toString(), request);
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
  breadcrumb("security", "Payload structure validated");
  breadcrumb("turnstile", "Turnstile verification started");
  await verifyTurnstile(
    env,
    body.turnstileToken,
    getIp(request),
    body.turnstileIdempotencyKey,
  );
  breadcrumb("turnstile", "Turnstile verification succeeded");
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

interface RequestCfProperties {
  country?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  continent?: string;
  timezone?: string;
  colo?: string;
  asn?: number;
  asOrganization?: string;
  httpProtocol?: string;
  tlsVersion?: string;
  tlsCipher?: string;
  latitude?: string;
  longitude?: string;
}

// Every field here is something Cloudflare's edge already computes for any
// request it proxies, for any site — this endpoint only echoes it back to
// the same visitor it belongs to, for a client-side transparency page. It
// is never logged, stored, or associated with anything else.
async function handleWhoami(request: Request, env: Env): Promise<Response> {
  await rateLimitIp(request, env, "whoami", 30, 60);
  const cf = (request.cf || {}) as RequestCfProperties;
  const ip = getIp(request);
  return json({
    ip: ip !== "unknown" ? ip : null,
    network: {
      asn: cf.asn ?? null,
      organization: cf.asOrganization ?? null,
      dataCenter: cf.colo ?? null,
      httpProtocol: cf.httpProtocol ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      tlsCipher: cf.tlsCipher ?? null,
    },
    location: {
      country: cf.country ?? null,
      city: cf.city ?? null,
      region: cf.region ?? null,
      regionCode: cf.regionCode ?? null,
      continent: cf.continent ?? null,
      timezone: cf.timezone ?? null,
      approxLatitude: cf.latitude ?? null,
      approxLongitude: cf.longitude ?? null,
    },
  });
}

function ipFamily(ip: string): "IPv4" | "IPv6" | null {
  if (!ip) return null;
  return ip.includes(":") ? "IPv6" : "IPv4";
}

// Deliberately public and unrestricted by Origin — this exists specifically
// for `curl`, which sends no Origin header at all. It only ever echoes the
// requester's own connecting IP back to them, same as ifconfig.me/icanhazip.
async function handleIp(request: Request, env: Env): Promise<Response> {
  await rateLimitIp(request, env, "ip", 60, 60);
  const ip = getIp(request);
  const family = ip !== "unknown" ? ipFamily(ip) : null;
  const url = new URL(request.url);
  const wantsJson = url.searchParams.get("format") === "json"
    || (request.headers.get("Accept") || "").includes("application/json");
  const requestedFamily = url.searchParams.get("family");
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

  if (wantsJson) return json({ ip: ip !== "unknown" ? ip : null, family });
  if (ip === "unknown") return new Response("Could not determine your IP address.\n", { headers });
  if (requestedFamily === "v4" && family !== "IPv4") {
    return new Response(
      `Your current connection used ${family}, not IPv4. Visiting over an IPv4-only network/DNS record would show an IPv4 address here.\n`,
      { headers },
    );
  }
  if (requestedFamily === "v6" && family !== "IPv6") {
    return new Response(
      `Your current connection used ${family}, not IPv6. Visiting over an IPv6-only network/DNS record would show an IPv6 address here.\n`,
      { headers },
    );
  }
  return new Response(`${ip}\n`, { headers });
}

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RDAP_ENDPOINT = "https://rdap.org/domain/";
// Matches a plain hostname: labels of letters/digits/hyphens, at least one
// dot, TLD letters-only. Deliberately rejects IP literals and anything with
// a scheme, port, path, or whitespace — the input is used only as a query
// value against DOH_ENDPOINT/RDAP_ENDPOINT below, never as a fetch() target
// host itself, so there is no SSRF surface here regardless, but rejecting
// non-hostnames early keeps the error message honest about what this
// endpoint accepts.
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeDomainInput(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\.$/, "");
  return DOMAIN_PATTERN.test(value) ? value : null;
}

async function dohLookup(domain: string, type: string, signal: AbortSignal): Promise<string[]> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`;
  const response = await fetch(url, { headers: { Accept: "application/dns-json" }, signal });
  if (!response.ok) return [];
  const data = await response.json<{ Answer?: { data: string }[] }>();
  return (data.Answer || []).map((entry) => entry.data.replace(/^"|"$/g, ""));
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, [string, unknown, string, string][]];
}

async function rdapLookup(domain: string, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${RDAP_ENDPOINT}${encodeURIComponent(domain)}`, { signal });
    if (!response.ok) return null;
    const data = await response.json<{
      events?: { eventAction: string; eventDate: string }[];
      entities?: RdapEntity[];
      status?: string[];
      nameservers?: { ldhName: string }[];
    }>();
    const findEvent = (action: string) =>
      data.events?.find((event) => event.eventAction === action)?.eventDate || null;
    const registrar = data.entities
      ?.find((entity) => entity.roles?.includes("registrar"))
      ?.vcardArray?.[1]?.find((field) => field[0] === "fn")?.[3] || null;
    return {
      registrar,
      registered: findEvent("registration"),
      expires: findEvent("expiration"),
      lastChanged: findEvent("last changed"),
      status: data.status || [],
      nameservers: (data.nameservers || []).map((entry) => entry.ldhName),
    };
  } catch {
    return null;
  }
}

// No live fetch() to the looked-up domain itself — every outbound call here
// targets a fixed, trusted host (Cloudflare's DNS-over-HTTPS resolver, or
// the RDAP bootstrap redirector), with the domain passed only as a query
// value. That keeps this endpoint's SSRF surface at zero: it can never be
// used to make this Worker issue a request to an arbitrary attacker-chosen
// origin, unlike a "check this site's HTTP headers" feature would.
async function handleDomainLookup(request: Request, env: Env): Promise<Response> {
  await rateLimitIp(request, env, "domain-lookup", 15, 300);
  const url = new URL(request.url);
  const domain = normalizeDomainInput(url.searchParams.get("domain") || "");
  if (!domain) return json({ error: "Provide a valid domain name, e.g. example.com." }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const [a, aaaa, mx, ns, txt, caa, registration] = await Promise.all([
      dohLookup(domain, "A", controller.signal),
      dohLookup(domain, "AAAA", controller.signal),
      dohLookup(domain, "MX", controller.signal),
      dohLookup(domain, "NS", controller.signal),
      dohLookup(domain, "TXT", controller.signal),
      dohLookup(domain, "CAA", controller.signal),
      rdapLookup(domain, controller.signal),
    ]);
    return json({
      domain,
      dns: { A: a, AAAA: aaaa, MX: mx, NS: ns, TXT: txt, CAA: caa },
      registration,
    });
  } finally {
    clearTimeout(timeout);
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

async function route(request: Request, env: Env, ctx: ExecutionContext, requestId?: string): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return isAllowedOrigin(request, env)
      ? new Response(null, { status: 204, headers: corsHeaders(request, env) })
      : json({ error: "Origin not allowed." }, 403);
  }
  if (url.pathname === "/api/sentry-test" && request.method === "POST") {
    if (env.SENTRY_TEST_ENABLED !== "true" || !env.SENTRY_TEST_KEY
      || request.headers.get("X-Sentry-Test-Key") !== env.SENTRY_TEST_KEY) {
      return json({ error: "Not found." }, 404);
    }
    sentryEvent(env, "F12 Sentry Worker integration test", "info", {
      operation: "sentry-test",
      result: "submitted",
    }, true);
    return json({ ok: true, sentryTest: "submitted", requestId: requestId || "unavailable" });
  }
  if (url.pathname === "/api/health" && request.method === "GET") return handleHealth(env);
  if (url.pathname === "/api/ip" && request.method === "GET") {
    // No isAllowedOrigin gate — curl sends no Origin header at all, and this
    // must keep working for that. But withCors() still adds the header a
    // real browser fetch() needs when an allowed Origin IS present (e.g.
    // the My IP tool page calling this from the browser); curl ignores CORS
    // headers entirely, so this doesn't affect terminal usage either way.
    return withCors(await handleIp(request, env), request, env);
  }
  if (url.pathname === "/api/whoami" && request.method === "GET") {
    if (!isAllowedOrigin(request, env)) throw new PublicError(403, "Request not allowed.", "invalid-origin");
    const response = await handleWhoami(request, env);
    return withCors(response, request, env);
  }
  if (url.pathname === "/api/domain-lookup" && request.method === "GET") {
    if (!isAllowedOrigin(request, env)) throw new PublicError(403, "Request not allowed.", "invalid-origin");
    const response = await handleDomainLookup(request, env);
    return withCors(response, request, env);
  }
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
  if (!isAllowedOrigin(request, env)) throw new PublicError(403, "Request not allowed.", "invalid-origin");
  breadcrumb("security", "Origin accepted");

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
    const requestId = crypto.randomUUID();
    const started = performance.now();
    request = normalizeApiDomainPath(request);
    const url = new URL(request.url);
    const operation = routeName(url.pathname);
    const method = request.method;
    if (method !== "OPTIONS") {
      ctx.waitUntil(incrementRouteCount(env, operation).catch(() => undefined));
    }
    const finish = (response: Response, result: string): Response => {
      const durationMs = Math.max(0, performance.now() - started);
      const bucket = durationBucket(durationMs);
      breadcrumb("response", "Safe response returned");
      if (durationMs >= Number(env.SENTRY_SLOW_REQUEST_MS || 3000)) {
        sentryEvent(env, "F12 Worker request slow", "warning", {
          operation, result, durationMs: Math.round(durationMs), durationBucket: bucket,
        });
      }
      return requestResponse(response, requestId);
    };

    return Sentry.withScope(async (scope) => {
      scope.setTag("component", "chat-worker");
      scope.setTag("route", operation);
      scope.setTag("method", method);
      scope.setTag("environment", env.ENVIRONMENT || "production");
      scope.setContext("request", { requestId, operation });
      breadcrumb("worker", "Worker request received");
      try {
        if (method === "OPTIONS") breadcrumb("security", "Request method accepted");
        const response = await route(request, env, ctx, requestId);
        if (method !== "OPTIONS") breadcrumb("security", "Request method accepted");
        const result = response.status >= 400 ? "rejected" : response.status >= 200 && response.status < 300 ? "accepted" : "failed";
        if (response.status === 404 && (url.pathname.startsWith("/api/") || url.pathname === "/")) {
          sentryEvent(env, "F12 Worker request rejected", "warning", {
            operation, result: "validation-rejected", reason: "invalid-method",
          });
        }
        if (operation === "start" && result === "accepted") {
          sentryEvent(env, "F12 chat submission received", "info", { operation: "chat-submit", result, requestId }, true);
        }
        return finish(response, result);
      } catch (error) {
        const publicError = error instanceof PublicError ? error : null;
        const reason = publicError?.code || "unexpected-error";
        const result = publicError ? "validation-rejected" : "delivery-failed";
        scope.setContext("failure", { requestId, operation, reason });
        if (!(error instanceof PublicError)) Sentry.captureException(error);
        if (publicError) {
          const rejectionReasons = new Set([
            "invalid-method", "origin", "invalid_json", "invalid-payload", "missing-turnstile", "turnstile-rejected",
          ]);
          if (rejectionReasons.has(reason)) {
            sentryEvent(env, "F12 Worker request rejected", "warning", { operation, result, reason, requestId });
          }
          if (reason === "turnstile_token_missing" || reason === "turnstile_rejected") {
            sentryEvent(env, "F12 Turnstile validation failed", "warning", {
              operation, result: "turnstile-rejected", reason,
              turnstile_present: reason !== "turnstile_token_missing", turnstile_valid: false,
            });
          }
        }
        safeLog(reason, { path: url.pathname });
        const response = json(
          { error: publicError?.message || "Something went wrong. Please try again." },
          publicError?.status || 500,
        );
        return finish(
          url.pathname.startsWith("/api/chat/") || url.pathname === "/" ? withCors(response, request, env) : response,
          result,
        );
      }
    });
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

      const retention = await findAndCleanupEligibleConversations(env);
      if (retention.eligibleConversationIds.length > 0) {
        sentryEvent(
          env,
          retention.deleted
            ? "F12 retention cleanup: eligible conversations deleted"
            : "F12 retention cleanup: eligible conversations found (dry run, RETENTION_CLEANUP_ENABLED is not \"true\")",
          "warning",
          {
            operation: "retention-cleanup",
            result: retention.deleted ? "deleted" : "dry-run",
            eligibleCount: retention.eligibleConversationIds.length,
          },
        );
      }
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
