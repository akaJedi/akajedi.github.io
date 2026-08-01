/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import worker from "../src/worker";
import type { Env } from "../src/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import migrationSql from "../migrations/0001_chat.sql?raw";
import draftMigrationSql from "../migrations/0002_conversation_drafts.sql?raw";
import sourceMigrationSql from "../migrations/0003_conversation_sources.sql?raw";
import routeCountsMigrationSql from "../migrations/0004_route_daily_counts.sql?raw";
import domainWatchesMigrationSql from "../migrations/0005_domain_watches.sql?raw";
import domainWatchAlertsMigrationSql from "../migrations/0006_domain_watch_alerts.sql?raw";
import { availability, createChallenge, escapeTelegram } from "../src/lib";
import { classifyDomainWatchAlert, domainWatchAlertsEnabled } from "../src/domain-watch-alerts";

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
    ...migrationQueries(routeCountsMigrationSql),
    ...migrationQueries(domainWatchesMigrationSql),
    ...migrationQueries(domainWatchAlertsMigrationSql),
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

it("counts /api/ip requests per day in route_daily_counts", async () => {
  const today = new Date().toISOString().slice(0, 10);
  await dispatch("https://worker.test/api/ip", { headers: { "CF-Connecting-IP": "203.0.113.9" } });
  let row: { count: number } | null = null;
  for (let attempt = 0; attempt < 20 && !row; attempt++) {
    row = await testEnv.DB.prepare("SELECT count FROM route_daily_counts WHERE date = ? AND route = 'ip'")
      .bind(today).first<{ count: number }>();
    if (!row) await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(row).not.toBeNull();
  expect(row!.count).toBeGreaterThanOrEqual(1);
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

function mockDomainLookupApis() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input);
    if (requestUrl.includes("cloudflare-dns.com/dns-query") || requestUrl.includes("dns.google/resolve")) {
      const query = new URL(requestUrl);
      const type = query.searchParams.get("type");
      const name = query.searchParams.get("name");
      const answers: Record<string, { type: number; data: string }[]> = {
        A: [{ type: 5, data: "alias.example.net." }, { type: 1, data: "93.184.216.34" }],
        AAAA: [{ type: 28, data: "2606:2800:220:1:248:1893:25c8:1946" }],
        CNAME: [],
        MX: [{ type: 15, data: "10 mail.example.com." }],
        NS: [{ type: 2, data: "a.iana-servers.net." }, { type: 2, data: "b.iana-servers.net." }],
        TXT: [{ type: 16, data: '"v=spf1 " "-all"' }],
        CAA: [{ type: 257, data: '0 issue "letsencrypt.org"' }],
        DS: [{ type: 43, data: "12345 13 2 AABBCCDD" }],
      };
      const answer = name === "_dmarc.example.com"
        ? [{ type: 16, data: '"v=DMARC1; p=reject"' }]
        : name === "_mta-sts.example.com"
          ? [{ type: 16, data: '"v=STSv1; id=20260731"' }]
          : answers[type || ""] || [];
      return new Response(JSON.stringify({ Status: 0, AD: true, Answer: answer }), {
        status: 200,
        headers: { "Content-Type": "application/dns-json" },
      });
    }
    if (requestUrl === "https://data.iana.org/rdap/dns.json") {
      return new Response(JSON.stringify({
        services: [[
          ["com", "net", "org", "info", "xn--p1ai"],
          ["https://rdap.registry.test/"],
        ]],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (requestUrl.includes("rdap.registry.test/domain/")) {
      return new Response(JSON.stringify({
        events: [
          { eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" },
          { eventAction: "expiration", eventDate: "2026-08-13T04:00:00Z" },
        ],
        entities: [{
          roles: ["registrar"],
          vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Test Registrar Inc."]]],
        }],
        status: ["active"],
        nameservers: [{ ldhName: "A.IANA-SERVERS.NET" }],
      }), { status: 200, headers: { "Content-Type": "application/rdap+json" } });
    }
    return new Response("not found", { status: 404 });
  });
}

function mockRdapScenario(
  handler: (requestUrl: string, call: number) => Response | Promise<Response>,
) {
  let rdapCalls = 0;
  const externalFetch = vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input);
    if (requestUrl.includes("cloudflare-dns.com/dns-query") || requestUrl.includes("dns.google/resolve")) {
      return new Response(JSON.stringify({ Status: 0, AD: false, Answer: [] }), {
        status: 200,
        headers: { "Content-Type": "application/dns-json" },
      });
    }
    if (requestUrl === "https://data.iana.org/rdap/dns.json") {
      return new Response(JSON.stringify({
        services: [[
          ["com", "net", "org", "info", "xn--p1ai"],
          ["https://rdap.registry.test/"],
        ]],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (requestUrl.includes("rdap.registry.test/domain/")) {
      rdapCalls += 1;
      return handler(requestUrl, rdapCalls);
    }
    return new Response("not found", { status: 404 });
  });
  return { externalFetch, getRdapCalls: () => rdapCalls };
}

it("rejects an invalid domain-lookup query", async () => {
  const response = await dispatch("https://worker.test/api/domain-lookup?domain=not%20a%20domain", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.10" },
  });
  expect(response.status).toBe(400);
});

it("rejects /api/domain-lookup from a disallowed origin", async () => {
  const response = await dispatch("https://worker.test/api/domain-lookup?domain=example.com", {
    headers: { Origin: "https://attacker.example", "CF-Connecting-IP": "203.0.113.10" },
  });
  expect(response.status).toBe(403);
});

it("returns combined DNS and registration data for a valid domain", async () => {
  const externalFetch = mockDomainLookupApis();
  vi.stubGlobal("fetch", externalFetch);
  const response = await dispatch("https://worker.test/api/domain-lookup?domain=EXAMPLE.com.", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.11" },
  });
  expect(response.status).toBe(200);
  const body = await response.json<any>();
  expect(body.domain).toBe("example.com");
  expect(body.dns.A).toEqual(["93.184.216.34"]);
  expect(body.dns.NS).toEqual(["a.iana-servers.net.", "b.iana-servers.net."]);
  expect(body.dns.TXT).toEqual(["v=spf1 -all"]);
  expect(body.dns.DMARC).toEqual(["v=DMARC1; p=reject"]);
  expect(body.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "nameserver-redundancy", status: "pass" }),
    expect.objectContaining({ id: "dnssec-valid", status: "pass" }),
    expect.objectContaining({ id: "spf-present", status: "pass" }),
    expect.objectContaining({ id: "dmarc-enforcing", status: "pass" }),
    expect.objectContaining({ id: "caa-present", status: "pass" }),
  ]));
  expect(body.registration.registrar).toBe("Test Registrar Inc.");
  expect(body.registration.registered).toBe("1995-08-14T04:00:00Z");
  expect(body.registration.expires).toBe("2026-08-13T04:00:00Z");
  expect(body.registrationLookup).toMatchObject({
    status: "ok",
    source: "iana-bootstrap",
    attempts: 1,
  });
  expect(body.consensus).toMatchObject({
    verdict: "consistent",
    privacy: { ednsClientSubnet: "0.0.0.0/0" },
    summary: { match: 10, different: 0, dnssecDisagreement: 0, unavailable: 0 },
  });
  expect(body.consensus.records).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: "A", state: "match" }),
    expect.objectContaining({ key: "DMARC", state: "match" }),
  ]));
  expect(externalFetch.mock.calls.some(([input]) => {
    const requestUrl = new URL(String(input));
    return requestUrl.hostname === "dns.google" &&
      requestUrl.searchParams.get("edns_client_subnet") === "0.0.0.0/0";
  })).toBe(true);
  expect(externalFetch.mock.calls.some(([input]) =>
    String(input) === "https://data.iana.org/rdap/dns.json"
  )).toBe(true);
  expect(externalFetch.mock.calls.some(([input]) =>
    String(input).includes("rdap.registry.test/domain/example.com")
  )).toBe(true);

  const cachedResponse = await dispatch("https://worker.test/api/domain-lookup?domain=example.com", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.111" },
  });
  expect((await cachedResponse.json<any>()).registrationLookup.cached).toBe(true);
  expect(externalFetch.mock.calls.filter(([input]) =>
    String(input).includes("rdap.registry.test/domain/example.com")
  )).toHaveLength(1);
});

it("creates, reuses, and samples a 24-hour DNS propagation watch", async () => {
  let changed = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = new URL(String(input));
    if (requestUrl.hostname !== "cloudflare-dns.com" && requestUrl.hostname !== "dns.google") {
      return new Response("not found", { status: 404 });
    }
    const isGoogle = requestUrl.hostname === "dns.google";
    const data = changed && isGoogle ? "198.51.100.20" : "192.0.2.10";
    return new Response(JSON.stringify({
      Status: 0,
      AD: false,
      Answer: [{ type: 1, TTL: changed ? 60 : 300, data }],
    }), { status: 200, headers: { "Content-Type": "application/dns-json" } });
  }));

  const create = await dispatch("https://worker.test/api/domain-watch", {
    method: "POST",
    headers: { ...jsonHeaders, "CF-Connecting-IP": "203.0.113.31" },
    body: JSON.stringify({ domain: "watch.example.com", recordKey: "A" }),
  });
  expect(create.status).toBe(201);
  const created = await create.json<any>();
  expect(created.reused).toBe(false);
  expect(created.watch).toMatchObject({
    domain: "watch.example.com",
    recordKey: "A",
    status: "active",
    sampleCount: 1,
    changeCount: 0,
    currentState: "match",
  });
  expect(created.watch.samples).toHaveLength(1);
  expect(Date.parse(created.watch.expiresAt) - Date.parse(created.watch.createdAt))
    .toBe(24 * 60 * 60 * 1000);

  const reused = await dispatch("https://worker.test/api/domain-watch", {
    method: "POST",
    headers: { ...jsonHeaders, "CF-Connecting-IP": "203.0.113.31" },
    body: JSON.stringify({ domain: "watch.example.com", recordKey: "A" }),
  });
  expect(reused.status).toBe(200);
  expect((await reused.json<any>()).reused).toBe(true);

  changed = true;
  await testEnv.DB.prepare("UPDATE domain_watches SET next_sample_at = ? WHERE id = ?")
    .bind("2020-01-01T00:00:00Z", created.watch.id).run();
  const scheduledPromises: Promise<unknown>[] = [];
  await (worker as any).scheduled(
    { cron: "*/5 * * * *", scheduledTime: Date.now(), noRetry() {} },
    testEnv,
    {
      waitUntil(promise: Promise<unknown>) { scheduledPromises.push(promise); },
      passThroughOnException() {},
      props: {},
    },
  );
  await Promise.all(scheduledPromises);

  const timeline = await dispatch(`https://worker.test/api/domain-watch/${created.watch.id}`, {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.32" },
  });
  expect(timeline.status).toBe(200);
  expect(timeline.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const body = await timeline.json<any>();
  expect(body.watch).toMatchObject({
    sampleCount: 2,
    changeCount: 1,
    currentState: "different",
  });
  expect(body.watch.samples[1]).toMatchObject({
    state: "different",
    changed: true,
    cloudflare: { answers: ["192.0.2.10"] },
    google: { answers: ["198.51.100.20"] },
  });
});

it("classifies, queues, and delivers managed-domain DNS alerts exactly once", async () => {
  expect(classifyDomainWatchAlert("match", "different", true)).toBe("diverged");
  expect(classifyDomainWatchAlert("different", "match", true)).toBe("converged");
  expect(classifyDomainWatchAlert("match", "match", true)).toBe("changed");
  expect(classifyDomainWatchAlert("match", "match", false)).toBeNull();
  expect(domainWatchAlertsEnabled(testEnv, "edge.f12.biz")).toBe(true);
  expect(domainWatchAlertsEnabled(testEnv, "example.com")).toBe(false);

  let changed = false;
  const externalFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input));
    if (requestUrl.hostname === "api.telegram.org") {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 8123 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (requestUrl.hostname !== "cloudflare-dns.com" && requestUrl.hostname !== "dns.google") {
      return new Response("not found", { status: 404 });
    }
    const isGoogle = requestUrl.hostname === "dns.google";
    const data = changed && isGoogle ? "198.51.100.20" : "192.0.2.10";
    return new Response(JSON.stringify({
      Status: 0,
      AD: false,
      Answer: [{ type: 1, TTL: 300, data }],
    }), { status: 200, headers: { "Content-Type": "application/dns-json" } });
  });
  vi.stubGlobal("fetch", externalFetch);

  const create = await dispatch("https://worker.test/api/domain-watch", {
    method: "POST",
    headers: { ...jsonHeaders, "CF-Connecting-IP": "203.0.113.41" },
    body: JSON.stringify({ domain: "alerts.f12.biz", recordKey: "A" }),
  });
  const created = await create.json<any>();
  changed = true;
  await testEnv.DB.prepare("UPDATE domain_watches SET next_sample_at = ? WHERE id = ?")
    .bind("2020-01-01T00:00:00Z", created.watch.id).run();

  const runScheduled = async (cron: string) => {
    const promises: Promise<unknown>[] = [];
    await (worker as any).scheduled(
      { cron, scheduledTime: Date.now(), noRetry() {} },
      testEnv,
      {
        waitUntil(promise: Promise<unknown>) { promises.push(promise); },
        passThroughOnException() {},
        props: {},
      },
    );
    await Promise.all(promises);
  };

  await runScheduled("*/5 * * * *");
  const queued = await testEnv.DB.prepare(
    "SELECT event_type, delivered_at FROM domain_watch_alerts WHERE watch_id = ?",
  ).bind(created.watch.id).all<{ event_type: string; delivered_at: string | null }>();
  expect(queued.results).toEqual([{ event_type: "diverged", delivered_at: null }]);

  await runScheduled("2-59/5 * * * *");
  await runScheduled("2-59/5 * * * *");
  const dnsMessages = externalFetch.mock.calls.filter(([input]) =>
    new URL(String(input)).hostname === "api.telegram.org"
  );
  expect(dnsMessages).toHaveLength(1);
  const telegramPayload = JSON.parse(String((dnsMessages[0][1] as RequestInit).body));
  expect(telegramPayload.text).toContain("DNS resolvers diverged");
  expect(telegramPayload.text).toContain("Previous");
  expect(telegramPayload.text).toContain("192.0.2.10");
  expect(telegramPayload.text).toContain("Current");
  expect(telegramPayload.text).toContain("198.51.100.20");
  expect(telegramPayload.text).toContain(created.watch.id);

  await testEnv.DB.prepare("UPDATE domain_watches SET status = 'active', expires_at = ? WHERE id = ?")
    .bind("2020-01-01T00:00:00Z", created.watch.id).run();
  await runScheduled("*/5 * * * *");
  await runScheduled("*/5 * * * *");
  const completion = await testEnv.DB.prepare(
    "SELECT COUNT(*) AS count FROM domain_watch_alerts WHERE watch_id = ? AND event_type = 'completed'",
  ).bind(created.watch.id).first<{ count: number }>();
  expect(completion?.count).toBe(1);
});

it("rejects unsupported propagation-watch record types with browser-safe CORS", async () => {
  const response = await dispatch("https://worker.test/api/domain-watch", {
    method: "POST",
    headers: { ...jsonHeaders, "CF-Connecting-IP": "203.0.113.33" },
    body: JSON.stringify({ domain: "example.com", recordKey: "SSHFP" }),
  });
  expect(response.status).toBe(400);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
});

it("classifies contradictory mail policy and broken DNSSEC as critical", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input);
    if (requestUrl.includes("cloudflare-dns.com/dns-query") || requestUrl.includes("dns.google/resolve")) {
      const query = new URL(requestUrl);
      const type = query.searchParams.get("type");
      const name = query.searchParams.get("name");
      const byType: Record<string, { type: number; data: string }[]> = {
        A: [{ type: 1, data: "192.0.2.10" }],
        NS: [{ type: 2, data: "only-ns.example.net." }],
        MX: [{ type: 15, data: "0 ." }, { type: 15, data: "10 mail.example.net." }],
        TXT: [{ type: 16, data: '"v=spf1 +all"' }, { type: 16, data: '"v=spf1 -all"' }],
        DS: [{ type: 43, data: "12345 13 2 DEADBEEF" }],
      };
      const answer = name === "_dmarc.example.net"
        ? [{ type: 16, data: '"v=DMARC1; p=none"' }, { type: 16, data: '"v=DMARC1; p=reject"' }]
        : byType[type || ""] || [];
      return new Response(JSON.stringify({ Status: 0, AD: false, Answer: answer }), {
        status: 200,
        headers: { "Content-Type": "application/dns-json" },
      });
    }
    if (requestUrl === "https://data.iana.org/rdap/dns.json") {
      return new Response(JSON.stringify({
        services: [[
          ["com", "net", "org", "info", "xn--p1ai"],
          ["https://rdap.registry.test/"],
        ]],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (requestUrl.includes("rdap.registry.test/domain/")) {
      return new Response(JSON.stringify({
        events: [{ eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" }],
      }), { status: 200, headers: { "Content-Type": "application/rdap+json" } });
    }
    return new Response("not found", { status: 404 });
  }));

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=example.net", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.12" },
  });
  expect(response.status).toBe(200);
  const body = await response.json<any>();
  const criticalIds = body.checks
    .filter((check: { status: string }) => check.status === "critical")
    .map((check: { id: string }) => check.id);
  expect(criticalIds).toEqual(expect.arrayContaining([
    "nameserver-redundancy",
    "dnssec-unvalidated",
    "mx-null-mixed",
    "spf-multiple",
    "dmarc-multiple",
  ]));
});

it("identifies resolver answer divergence with TTL evidence", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input);
    if (requestUrl.includes("cloudflare-dns.com/dns-query") || requestUrl.includes("dns.google/resolve")) {
      const query = new URL(requestUrl);
      const isGoogle = query.hostname === "dns.google";
      const type = query.searchParams.get("type");
      const answer = type === "A"
        ? [{ type: 1, TTL: isGoogle ? 60 : 120, data: isGoogle ? "198.51.100.20" : "192.0.2.10" }]
        : [];
      return new Response(JSON.stringify({ Status: 0, AD: false, Answer: answer }), {
        status: 200,
        headers: { "Content-Type": "application/dns-json" },
      });
    }
    if (requestUrl === "https://data.iana.org/rdap/dns.json") {
      return new Response(JSON.stringify({
        services: [[["net"], ["https://rdap.registry.test/"]]],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (requestUrl.includes("rdap.registry.test/domain/")) {
      return new Response(JSON.stringify({ status: ["active"] }), {
        status: 200,
        headers: { "Content-Type": "application/rdap+json" },
      });
    }
    return new Response("not found", { status: 404 });
  }));

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=consensus.example.net", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.17" },
  });
  const body = await response.json<any>();
  const aRecord = body.consensus.records.find((record: { key: string }) => record.key === "A");
  expect(response.status).toBe(200);
  expect(body.consensus.verdict).toBe("inconsistent");
  expect(body.consensus.summary.different).toBe(1);
  expect(aRecord).toMatchObject({
    state: "different",
    cloudflare: { answers: ["192.0.2.10"], ttl: 120 },
    google: { answers: ["198.51.100.20"], ttl: 60 },
  });
});

it("retries a transient authoritative RDAP failure once", async () => {
  const scenario = mockRdapScenario((_requestUrl, call) => {
    if (call === 1) return new Response("busy", { status: 503 });
    return new Response(JSON.stringify({
      events: [{ eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" }],
      status: ["active"],
    }), { status: 200, headers: { "Content-Type": "application/rdap+json" } });
  });
  vi.stubGlobal("fetch", scenario.externalFetch);

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=example.org", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.13" },
  });
  const body = await response.json<any>();
  expect(response.status).toBe(200);
  expect(body.registration.expires).toBe("2030-01-01T00:00:00Z");
  expect(body.registrationLookup).toMatchObject({ status: "ok", attempts: 2 });
  expect(scenario.getRdapCalls()).toBe(2);
});

it("reports authoritative RDAP not-found separately from an outage", async () => {
  const scenario = mockRdapScenario(() => new Response("missing", { status: 404 }));
  vi.stubGlobal("fetch", scenario.externalFetch);

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=example.info", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.14" },
  });
  const body = await response.json<any>();
  expect(body.registration).toBeNull();
  expect(body.registrationLookup).toMatchObject({ status: "not_found", attempts: 1 });
  expect(body.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: "registration-expiry-unknown",
      evidence: ["The authoritative RDAP service did not find this domain"],
    }),
  ]));
});

it("accepts an IDN TLD and exposes malformed RDAP responses", async () => {
  const scenario = mockRdapScenario(() => new Response("not-json", {
    status: 200,
    headers: { "Content-Type": "application/rdap+json" },
  }));
  vi.stubGlobal("fetch", scenario.externalFetch);

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80.%D1%80%D1%84", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.15" },
  });
  const body = await response.json<any>();
  expect(response.status).toBe(200);
  expect(body.domain).toBe("xn--e1afmkfd.xn--p1ai");
  expect(body.registrationLookup).toMatchObject({
    status: "invalid_response",
    attempts: 1,
  });
});

it("reports TLDs absent from the IANA bootstrap as unsupported", async () => {
  const scenario = mockRdapScenario(() => new Response("unexpected", { status: 500 }));
  vi.stubGlobal("fetch", scenario.externalFetch);

  const response = await dispatch("https://worker.test/api/domain-lookup?domain=example.unsupported", {
    headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.16" },
  });
  const body = await response.json<any>();
  expect(response.status).toBe(200);
  expect(body.registrationLookup).toMatchObject({
    status: "unsupported",
    attempts: 0,
  });
  expect(scenario.getRdapCalls()).toBe(0);
});

it("returns a safe failure when D1 is unavailable", async () => {
  await testEnv.DB.prepare("DROP TABLE conversations").run();
  const response = await dispatch("https://worker.test/api/chat/messages", {
    headers: { Origin: origin, Authorization: "Bearer invalid.foo", "X-Conversation-ID": "invalid" },
  });
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("SQLITE");
});
