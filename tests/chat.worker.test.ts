/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import worker from "../src/worker";
import type { Env } from "../src/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import migrationSql from "../migrations/0001_chat.sql?raw";
import draftMigrationSql from "../migrations/0002_conversation_drafts.sql?raw";
import sourceMigrationSql from "../migrations/0003_conversation_sources.sql?raw";
import { availability, createChallenge, escapeTelegram } from "../src/lib";

const origin = "https://www.f12.biz";
const jsonHeaders = { Origin: origin, "Content-Type": "application/json" };
const testEnv = env as unknown as Env;
const testContext = {
  waitUntil(promise: Promise<unknown>) { promise.catch(() => undefined); },
  passThroughOnException() {},
  props: {},
} as ExecutionContext;
const dispatch = (url: string, init?: RequestInit) =>
  worker.fetch(new Request(url, init), testEnv, testContext);

const validTurnstileResult = {
  success: true,
  hostname: "www.f12.biz",
  action: "chat_start",
  challenge_ts: new Date().toISOString(),
};

function mockTurnstile(result: Record<string, unknown> = validTurnstileResult) {
  const externalFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 9001 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", externalFetch);
  return externalFetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function migrationQueries(sql: string): string[] {
  return sql
    .split(";")
    .map((query) => query.trim())
    .filter(Boolean);
}

beforeAll(async () => {
  const migrations = [
    ...migrationQueries(migrationSql),
    ...migrationQueries(draftMigrationSql),
    ...migrationQueries(sourceMigrationSql),
  ];
  await testEnv.DB.batch(migrations.map((query) => testEnv.DB.prepare(query)));
});

let visitorSequence = 10;

async function startConversation(
  overrides: Record<string, unknown> = {},
  turnstileResult: Record<string, unknown> = validTurnstileResult,
) {
  const externalFetch = mockTurnstile(turnstileResult);
  const submissionToken = await createChallenge(
    testEnv.SESSION_HASH_SECRET!,
    Date.now() - 3000,
  );
  const response = await dispatch("https://worker.test/api/chat/start", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      "CF-Connecting-IP": "192.0.2." + visitorSequence++,
    },
    body: JSON.stringify({
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "",
      message: "Help with a Windows server migration.",
      timezone: "America/New_York",
      clientMessageId: crypto.randomUUID(),
      submissionToken,
      website: "",
      turnstileToken: "test-turnstile-token",
      turnstileIdempotencyKey: crypto.randomUUID(),
      ...overrides,
    }),
  });
  return { response, body: await response.json<any>(), externalFetch };
}

function authHeaders(body: any) {
  return {
    ...jsonHeaders,
    Authorization: `Bearer ${body.sessionToken}`,
    "X-Conversation-ID": body.conversationId,
  };
}

describe("quiet hours", () => {
  const cases = [
    ["2026-01-15T06:59:00Z", true],
    ["2026-01-15T07:00:00Z", false],
    ["2026-01-15T13:59:00Z", false],
    ["2026-01-15T14:00:00Z", true],
    ["2026-07-18T05:59:00Z", true],
    ["2026-07-18T06:00:00Z", false],
    ["2026-07-18T12:59:00Z", false],
    ["2026-07-18T13:00:00Z", true],
  ] as const;

  for (const [timestamp, expectedAvailable] of cases) {
    it(`${timestamp} availability is ${expectedAvailable}`, () => {
      expect(availability(testEnv, new Date(timestamp)).available).toBe(expectedAvailable);
    });
  }

  it("returns DST-aware offsets", () => {
    expect(availability(testEnv, new Date("2026-01-15T20:00:00Z")).serverTime).toContain("-08:00");
    expect(availability(testEnv, new Date("2026-07-18T20:00:00Z")).serverTime).toContain("-07:00");
  });
});

it("creates a durable conversation and rejects an invalid session token", async () => {
  const { response, body } = await startConversation();
  expect(response.status).toBe(201);
  expect(body.sessionToken).toMatch(new RegExp(`^${body.conversationId}\\.`));
  const stored = await testEnv.DB.prepare("SELECT * FROM conversations WHERE id = ?")
    .bind(body.conversationId)
    .first<any>();
  expect(stored.session_token_hash).not.toContain(body.sessionToken);
  expect(stored.visitor_email).toBe("jane@example.com");

  const invalid = await dispatch("https://worker.test/api/chat/messages", {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${body.conversationId}.wrong`,
      "X-Conversation-ID": body.conversationId,
    },
  });
  expect(invalid.status).toBe(401);
});

it("validates Turnstile through Siteverify with the visitor IP and an idempotency key", async () => {
  const { response, externalFetch } = await startConversation();
  expect(response.status).toBe(201);
  const siteverifyCall = externalFetch.mock.calls.find(([input]) =>
    String(input).includes("challenges.cloudflare.com/turnstile/v0/siteverify"),
  );
  expect(siteverifyCall).toBeTruthy();
  const parameters = new URLSearchParams(String(siteverifyCall?.[1]?.body));
  expect(parameters.get("response")).toBe("test-turnstile-token");
  expect(parameters.get("remoteip")).toMatch(/^192\.0\.2\./);
  expect(parameters.get("idempotency_key")).toMatch(/^[0-9a-f-]{36}$/);
});

it("rejects missing, failed, wrong-action, and wrong-hostname Turnstile results", async () => {
  const missing = await startConversation({ turnstileToken: "" });
  expect(missing.response.status).toBe(400);
  expect(missing.body).toEqual({ error: "Please complete the security check again." });
  expect(missing.externalFetch).not.toHaveBeenCalled();

  const failed = await startConversation({}, { success: false, "error-codes": ["invalid-input-response"] });
  expect(failed.response.status).toBe(400);

  const wrongAction = await startConversation({}, {
    success: true, hostname: "www.f12.biz", action: "different_action",
  });
  expect(wrongAction.response.status).toBe(400);

  const wrongHostname = await startConversation({}, {
    success: true, hostname: "attacker.example", action: "chat_start",
  });
  expect(wrongHostname.response.status).toBe(400);
});

it("autosaves, restores, and clears an authenticated message draft", async () => {
  const started = await startConversation();
  const headers = authHeaders(started.body);

  const save = await dispatch("https://worker.test/api/chat/draft", {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: "Unsent migration detail" }),
  });
  expect(save.status).toBe(200);

  const restore = await dispatch("https://worker.test/api/chat/draft", { headers });
  expect(restore.status).toBe(200);
  expect(await restore.json<any>()).toMatchObject({ message: "Unsent migration detail" });

  const send = await dispatch("https://worker.test/api/chat/message", {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Unsent migration detail",
      clientMessageId: crypto.randomUUID(),
    }),
  });
  expect(send.status).toBe(200);
  const remaining = await testEnv.DB.prepare(
    "SELECT COUNT(*) AS count FROM conversation_drafts WHERE conversation_id = ?",
  ).bind(started.body.conversationId).first<any>();
  expect(remaining.count).toBe(0);
});

it("saves a callback request and updates conversation status", async () => {
  const started = await startConversation();
  const response = await dispatch("https://worker.test/api/chat/callback", {
    method: "POST",
    headers: authHeaders(started.body),
    body: JSON.stringify({
      name: "Jane Smith",
      phone: "+1 (415) 555-0102",
      email: "jane@example.com",
      reason: "Discuss the migration window",
      preferredCallbackAt: "2026-07-20T18:30:00.000Z",
      timezone: "America/New_York",
      consent: true,
    }),
  });
  expect(response.status).toBe(200);
  const callback = await testEnv.DB.prepare("SELECT * FROM callback_requests").first<any>();
  expect(callback.phone_original).toBe("+1 (415) 555-0102");
  expect(callback.phone_normalized).toBe("+14155550102");
  expect(callback.consent_given).toBe(1);
  const conversation = await testEnv.DB.prepare("SELECT status FROM conversations").first<any>();
  expect(conversation.status).toBe("callback_pending");
});

it("rejects an invalid Telegram webhook secret", async () => {
  const response = await dispatch("https://worker.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "wrong" },
    body: JSON.stringify({ update_id: 1 }),
  });
  expect(response.status).toBe(401);
});

it("ignores unauthorized Telegram chats", async () => {
  const response = await dispatch("https://worker.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": testEnv.TELEGRAM_WEBHOOK_SECRET! },
    body: JSON.stringify({ update_id: 2, message: { message_id: 5, chat: { id: 999 }, text: "intrusion" } }),
  });
  expect(response.status).toBe(200);
  expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM messages WHERE sender_type = 'owner'").first<any>()).count).toBe(0);
});

it("maps an owner reply and processes duplicate webhook delivery once", async () => {
  const started = await startConversation();
  await testEnv.DB.prepare(
    "INSERT INTO telegram_message_map (telegram_chat_id, telegram_message_id, conversation_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("424242", 88, started.body.conversationId, new Date().toISOString())
    .run();
  const update = {
    update_id: 77,
    message: {
      message_id: 99,
      chat: { id: 424242 },
      text: "I can help with that migration.",
      reply_to_message: { message_id: 88 },
    },
  };
  const send = () => dispatch("https://worker.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": testEnv.TELEGRAM_WEBHOOK_SECRET! },
    body: JSON.stringify(update),
  });
  expect((await send()).status).toBe(200);
  expect((await send()).status).toBe(200);
  const owners = await testEnv.DB.prepare("SELECT * FROM messages WHERE sender_type = 'owner'").all<any>();
  expect(owners.results).toHaveLength(1);
  const conversation = await testEnv.DB.prepare("SELECT status FROM conversations").first<any>();
  expect(conversation.status).toBe("active");
});

it("stores SQL and HTML injection attempts as plain text", async () => {
  const injection = "Robert\x27); DROP TABLE conversations;-- <script>alert(1)</script>";
  const started = await startConversation({ message: injection });
  expect(started.response.status).toBe(201);
  const row = await testEnv.DB.prepare("SELECT message_text FROM messages WHERE sender_type = ? AND conversation_id = ?").bind("visitor", started.body.conversationId).first<any>();
  expect(row.message_text).toBe(injection);
  expect(escapeTelegram(injection)).toContain("&lt;script&gt;");
  const conversations = await testEnv.DB.prepare("SELECT COUNT(*) AS count FROM conversations").first<any>();
  expect(conversations.count).toBeGreaterThan(0);
});

it("rejects oversized JSON", async () => {
  const response = await dispatch("https://worker.test/api/chat/start", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ message: "x".repeat(17_000) }),
  });
  expect(response.status).toBe(413);
});

it("enforces availability rate limits by hashed IP", async () => {
  // The rate limiter buckets requests into fixed wall-clock windows
  // (Math.floor(now / windowSeconds) * windowSeconds), so 61 real-time
  // sequential requests can straddle a window boundary under CI load and
  // reset the counter mid-test. Pin only Date so the window can't roll
  // over mid-loop, while leaving real async/timer scheduling untouched.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

  let response: Response | undefined;
  for (let index = 0; index < 61; index += 1) {
    response = await dispatch("https://worker.test/api/chat/availability", {
      headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.7" },
    });
  }
  expect(response?.status).toBe(429);
  const stored = await testEnv.DB.prepare("SELECT rate_key FROM rate_limit_windows WHERE action = 'availability'").first<any>();
  expect(stored.rate_key).not.toContain("203.0.113.7");
});

it("does not expose local diagnostics on a deployed hostname", async () => {
  const response = await dispatch("https://worker.test/api/chat/dev-status", {
    headers: { Origin: origin },
  });
  expect(response.status).toBe(404);
  expect(await response.json<any>()).toEqual({ error: "Not found." });
});

it("returns the requester's own IP as plain text, with format/family options", async () => {
  const plain = await dispatch("https://worker.test/api/ip", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(plain.headers.get("Content-Type")).toContain("text/plain");
  expect(await plain.text()).toBe("203.0.113.9\n");

  const asJson = await dispatch("https://worker.test/api/ip?format=json", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(await asJson.json<any>()).toEqual({ ip: "203.0.113.9", family: "IPv4" });

  const wrongFamily = await dispatch("https://worker.test/api/ip?family=v6", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(await wrongFamily.text()).toContain("IPv4, not IPv6");

  const matchingFamily = await dispatch("https://worker.test/api/ip?family=v4", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(await matchingFamily.text()).toBe("203.0.113.9\n");
});

it("does not require an Origin header for /api/ip (curl sends none)", async () => {
  const response = await dispatch("https://worker.test/api/ip", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(response.status).toBe(200);
});

it("sends Access-Control-Allow-Origin on /api/ip when a browser calls it with an allowed Origin", async () => {
  // curl ignores CORS headers entirely, so the endpoint "worked" for curl
  // even when this header was missing — but a real browser fetch() from
  // the My IP tool page silently fails to read the response without it.
  const response = await dispatch("https://worker.test/api/ip", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
});

it("serves /ip on the api.f12.biz custom domain without the /api prefix", async () => {
  const response = await dispatch("https://api.f12.biz/ip", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("203.0.113.9\n");
});

it("still serves /api/ip on api.f12.biz for anyone using the old path", async () => {
  const response = await dispatch("https://api.f12.biz/api/ip", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(response.status).toBe(200);
});

it("leaves the /api prefix alone on domains other than api.f12.biz", async () => {
  const response = await dispatch("https://worker.test/ip", {
    headers: { "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(response.status).toBe(404);
});

it("rejects /api/whoami from a disallowed origin but serves allowed ones", async () => {
  const blocked = await dispatch("https://worker.test/api/whoami", {
    headers: { Origin: "https://attacker.example", "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(blocked.status).toBe(403);

  const allowed = await dispatch("https://worker.test/api/whoami", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.9" },
  });
  expect(allowed.status).toBe(200);
  const body = await allowed.json<any>();
  expect(body.ip).toBe("203.0.113.9");
  expect(body).toHaveProperty("network");
  expect(body).toHaveProperty("location");
});

it("returns a safe failure when D1 is unavailable", async () => {
  await testEnv.DB.prepare("DROP TABLE conversations").run();
  const response = await dispatch("https://worker.test/api/chat/messages", {
    headers: { Origin: origin, Authorization: "Bearer invalid.foo", "X-Conversation-ID": "invalid" },
  });
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("SQLITE");
});
