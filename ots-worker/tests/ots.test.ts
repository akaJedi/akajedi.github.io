/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import worker, { cleanup } from "../src/index";
import migrationSql from "../migrations/0001_ots.sql?raw";
import { beforeAll, describe, expect, it } from "vitest";

const testEnv = env as unknown as Parameters<typeof cleanup>[0];
const context = { waitUntil(promise: Promise<unknown>) { promise.catch(() => undefined); }, passThroughOnException() {}, props: {} } as ExecutionContext;
const dispatch = (path: string, init?: RequestInit) => worker.fetch!(new Request(`https://ots.test${path}`, init), testEnv, context);

beforeAll(async () => {
  const queries = migrationSql.split(";").map((query) => query.trim()).filter(Boolean);
  await testEnv.DB.batch(queries.map((query) => testEnv.DB.prepare(query)));
});

describe("locked OTS deployment", () => {
  it("serves a strict, zero-third-party holding page", async () => {
    const result = await dispatch("/");
    const body = await result.text();
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(result.headers.get("Cache-Control")).toContain("no-transform");
    expect(result.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(result.headers.get("X-Frame-Options")).toBe("DENY");
    expect(body).toContain("No secrets accepted yet.");
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).not.toContain("<script");
  });
  it("reports healthy storage without accepting secrets", async () => {
    const result = await dispatch("/api/health");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, storage: "ready", acceptingSecrets: false });
  });
  it("fails closed for unimplemented APIs", async () => {
    expect((await dispatch("/api/secrets")).status).toBe(503);
    expect((await dispatch("/api/secrets", { method: "POST" })).status).toBe(405);
  });
  it("removes expired secret material and rate windows", async () => {
    const now = Date.now();
    await testEnv.DB.prepare("INSERT INTO ots_secrets (id,ciphertext,iv,claim_token_hash,mode,size_bytes,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind("expired", "ciphertext", "iv", "hash", "owner", 10, now - 20_000, now - 10_000).run();
    await testEnv.DB.prepare("INSERT INTO ots_rate_limit_windows (subject_hash,action,window_start,expires_at) VALUES (?,?,?,?)").bind("subject", "create", now - 20_000, now - 10_000).run();
    await cleanup(testEnv, now);
    expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM ots_secrets").first<{ count: number }>())?.count).toBe(0);
    expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM ots_rate_limit_windows").first<{ count: number }>())?.count).toBe(0);
  });
});
