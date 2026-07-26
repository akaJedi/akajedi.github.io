import { env } from "cloudflare:workers";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import migrationSql from "../migrations/0001_chat.sql?raw";
import draftMigrationSql from "../migrations/0002_conversation_drafts.sql?raw";
import sourceMigrationSql from "../migrations/0003_conversation_sources.sql?raw";
import routeCountsMigrationSql from "../migrations/0004_route_daily_counts.sql?raw";
import worker from "../src/worker";
import type { Env } from "../src/types";

const testEnv = env as unknown as Env;
let pending: Promise<unknown>[] = [];
const context = {
  waitUntil(promise: Promise<unknown>) { pending.push(promise); },
  passThroughOnException() {},
  props: {},
} as ExecutionContext;

function migrationQueries(sql: string): string[] {
  return sql.split(";").map((query) => query.trim()).filter(Boolean);
}

beforeAll(async () => {
  const migrations = [migrationSql, draftMigrationSql, sourceMigrationSql, routeCountsMigrationSql]
    .flatMap(migrationQueries);
  await testEnv.DB.batch(migrations.map((query) => testEnv.DB.prepare(query)));
});

afterEach(() => vi.unstubAllGlobals());

it("stores a contact-form lead durably and sends its Telegram notification", async () => {
  pending = [];
  let requestUrl = "";
  let requestBody: any;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 12 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));

  const response = await worker.fetch(
    new Request("https://worker.test/", {
      method: "POST",
      headers: {
        Origin: "https://www.f12.biz",
        Referer: "https://www.f12.biz/contact/?private=discard-this",
        "CF-Connecting-IP": "192.0.2.201",
        "User-Agent": "Test Browser/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Regression Test",
        email: "tests@example.com",
        phone: "+1 555 0100",
        message: "No external message is sent.",
        secret_field: "",
      }),
    }),
    testEnv,
    context,
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  await Promise.all(pending);
  expect(requestUrl).toContain("/bottest-bot-token/sendMessage");
  expect(requestBody.chat_id).toBe("424242");
  expect(requestBody.text).toContain("New contact form lead");
  expect(requestBody.text).toContain("Page:</b> /contact/");
  expect(requestBody.text).not.toContain("private=discard-this");
  expect(requestBody.text).toContain("Regression Test");
  expect(requestBody.text).toContain("Follow up using the visitor’s email or phone");

  const conversation = await testEnv.DB.prepare(
    `SELECT id, source_type, source_page, visitor_email, visitor_phone,
            session_token_hash, ip_hash, user_agent_summary
       FROM conversations WHERE visitor_email = ?`,
  ).bind("tests@example.com").first<Record<string, string>>();
  expect(conversation).toMatchObject({
    source_type: "contact_form",
    source_page: "/contact/",
    visitor_email: "tests@example.com",
    visitor_phone: "+1 555 0100",
    user_agent_summary: "Test Browser/1.0",
  });
  expect(conversation?.session_token_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(conversation?.ip_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(conversation?.ip_hash).not.toContain("192.0.2.201");

  const storedMessage = await testEnv.DB.prepare(
    "SELECT message_text FROM messages WHERE conversation_id = ? AND sender_type = 'visitor'",
  ).bind(conversation!.id).first<{ message_text: string }>();
  expect(storedMessage?.message_text).toBe("No external message is sent.");
  const mapping = await testEnv.DB.prepare(
    "SELECT telegram_message_id FROM telegram_message_map WHERE conversation_id = ?",
  ).bind(conversation!.id).first();
  expect(mapping).toBeNull();
});

it("accepts the legacy honeypot without storing or notifying", async () => {
  pending = [];
  const telegram = vi.fn();
  vi.stubGlobal("fetch", telegram);
  const before = await testEnv.DB.prepare("SELECT COUNT(*) AS count FROM conversations")
    .first<{ count: number }>();
  const response = await worker.fetch(
    new Request("https://worker.test/", {
      method: "POST",
      headers: { Origin: "https://www.f12.biz", "Content-Type": "application/json" },
      body: JSON.stringify({ secret_field: "bot", name: "Bot", email: "bot@example.com", message: "spam" }),
    }),
    testEnv,
    context,
  );
  const after = await testEnv.DB.prepare("SELECT COUNT(*) AS count FROM conversations")
    .first<{ count: number }>();
  expect(response.status).toBe(200);
  expect(telegram).not.toHaveBeenCalled();
  expect(after?.count).toBe(before?.count);
});
