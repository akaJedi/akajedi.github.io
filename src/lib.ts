import type { Availability, Env } from "./types";

export const MAX_BODY_BYTES = 16 * 1024;
export const QUIET_MESSAGE =
  "Thanks for contacting me. I’m currently unavailable between 11:00 PM and 6:00 AM Los Angeles time. Please leave your message and contact information, and I’ll respond or call you back as soon as possible.";
export const AVAILABLE_MESSAGE =
  "I’m available to receive your message. I’ll reply here as soon as possible.";

const encoder = new TextEncoder();

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function getAllowedOrigins(env: Env): Set<string> {
  const defaults = [
    "https://www.f12.biz",
    "https://f12.biz",
    "https://cloudflare.f12.biz",
    "https://f12-biz.pages.dev",
    "https://netlify.f12.biz",
    "https://f12-biz.netlify.app",
    "https://github.f12.biz",
  ];
  return new Set(
    (env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(",") : defaults)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  return Boolean(origin && getAllowedOrigins(env).has(origin));
}

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  if (!getAllowedOrigins(env).has(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Conversation-ID",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("Content-Length") || "0");
  if (declared > MAX_BODY_BYTES) throw new PublicError(413, "Request is too large.", "body_declared_large");
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    throw new PublicError(415, "Unsupported request.", "content_type");
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new PublicError(413, "Request is too large.", "body_stream_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("shape");
    return parsed as Record<string, unknown>;
  } catch {
    throw new PublicError(400, "Invalid request.", "invalid_json");
  }
}

export class PublicError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function requiredString(
  value: unknown,
  field: string,
  max: number,
): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean || clean.length > max) {
    throw new PublicError(400, `Please check the ${field} field.`, `invalid_${field}`);
  }
  return clean;
}

export function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean || clean.length > max) {
    throw new PublicError(400, `Please check the ${field} field.`, `invalid_${field}`);
  }
  return clean;
}

export function validateEmail(value: string | null): string | null {
  if (!value) return null;
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new PublicError(400, "Please enter a valid email address.", "invalid_email");
  }
  return value;
}

export function validateTimezone(value: string | null): string | null {
  if (!value) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    throw new PublicError(400, "Please check the timezone.", "invalid_timezone");
  }
}

export function normalizePhone(value: string): string | null {
  const clean = value.trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return clean.startsWith("+") ? `+${digits}` : digits;
}

function timezoneParts(date: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function zonedIso(date: Date, timezone: string): string {
  const p = timezoneParts(date, timezone);
  const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMinutes = Math.round((represented - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

export function availability(env: Env, date = new Date()): Availability {
  const timezone = env.OWNER_TIMEZONE || "America/Los_Angeles";
  const start = Number(env.QUIET_HOURS_START || "23");
  const end = Number(env.QUIET_HOURS_END || "6");
  const hour = Number(timezoneParts(date, timezone).hour);
  const quiet = start === end ? false : start > end ? hour >= start || hour < end : hour >= start && hour < end;
  return {
    available: !quiet,
    timezone,
    quietHoursStart: `${String(start).padStart(2, "0")}:00`,
    quietHoursEnd: `${String(end).padStart(2, "0")}:00`,
    serverTime: zonedIso(date, timezone),
  };
}

export function formatLosAngeles(date: Date, timezone = "America/Los_Angeles"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashValue(secret: string, domain: string, value: string): Promise<string> {
  return base64url(await hmac(secret, `${domain}:${value}`));
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let difference = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (aa[index % aa.length] || 0) ^ (bb[index % bb.length] || 0);
  }
  return difference === 0;
}

interface TurnstileVerification {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export async function verifyTurnstile(
  env: Env,
  token: unknown,
  remoteIp: string,
  idempotencyKey: unknown,
  expectedAction = "chat_start",
): Promise<void> {
  if (env.TURNSTILE_REQUIRED !== "true") return;
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new PublicError(503, "Security verification is temporarily unavailable.", "turnstile_secret_missing");
  }
  const responseToken = typeof token === "string" ? token.trim() : "";
  const requestId = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (!responseToken || responseToken.length > 2048) {
    throw new PublicError(400, "Please complete the security check again.", "turnstile_token_missing");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new PublicError(400, "Please complete the security check again.", "turnstile_idempotency_invalid");
  }
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: responseToken,
    idempotency_key: requestId,
  });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let verification: TurnstileVerification;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error("siteverify_" + response.status);
    verification = (await response.json()) as TurnstileVerification;
  } catch {
    throw new PublicError(503, "Security verification is temporarily unavailable.", "turnstile_unavailable");
  }

  const expectedHostnames = new Set(
    (env.TURNSTILE_EXPECTED_HOSTNAMES || "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
  const hostname = verification.hostname?.toLowerCase() || "";
  const testMode = env.TURNSTILE_TEST_MODE === "true";
  if (
    !verification.success
    || (verification.action !== expectedAction && !(testMode && !verification.action))
    || !hostname
    || !expectedHostnames.has(hostname)
  ) {
    throw new PublicError(400, "Please complete the security check again.", "turnstile_rejected");
  }
}

export async function createChallenge(secret: string, now = Date.now()): Promise<string> {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${now}.${nonce}`;
  return `${payload}.${await hashValue(secret, "challenge", payload)}`;
}

export async function verifyChallenge(secret: string, token: unknown, now = Date.now()): Promise<void> {
  if (typeof token !== "string") throw new PublicError(400, "Please refresh and try again.", "challenge_missing");
  const [issuedRaw, nonce, signature, extra] = token.split(".");
  const issued = Number(issuedRaw);
  if (!issued || !nonce || !signature || extra) throw new PublicError(400, "Please refresh and try again.", "challenge_invalid");
  const expected = await hashValue(secret, "challenge", `${issuedRaw}.${nonce}`);
  if (!constantTimeEqual(signature, expected)) throw new PublicError(400, "Please refresh and try again.", "challenge_invalid");
  const age = now - issued;
  if (age < 2_000) throw new PublicError(429, "Please wait a moment and try again.", "submitted_too_fast");
  if (age > 2 * 60 * 60 * 1000 || age < 0) throw new PublicError(400, "Please refresh and try again.", "challenge_expired");
}

export function escapeTelegram(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function safeLog(code: string, details: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: "error", code, ...details }));
}

