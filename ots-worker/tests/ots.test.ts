/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import worker, { cleanup } from "../src/app";
import migrationSql from "../migrations/0001_ots.sql?raw";
import { beforeAll, describe, expect, it } from "vitest";

const testEnv = env as unknown as Parameters<typeof cleanup>[0];
const enabledEnv = Object.assign(Object.create(testEnv), {
  OWNER_CREATION_ENABLED: "true",
  PUBLIC_TRIAL_ENABLED: "false",
  OTS_TOKEN_HMAC_SECRET: "test-token-hmac-secret",
  OTS_IP_HASH_SECRET: "test-ip-hash-secret",
  OTS_SESSION_SECRET: "test-session-secret",
});
const context = { waitUntil(promise: Promise<unknown>) { promise.catch(() => undefined); }, passThroughOnException() {}, props: {} } as ExecutionContext;
const dispatch = (path: string, init?: RequestInit, bindings = enabledEnv) => worker.fetch!(new Request(`https://ots.test${path}`, init), bindings, context);

beforeAll(async () => {
  const queries = migrationSql.split(";").map((query) => query.trim()).filter(Boolean);
  await testEnv.DB.batch(queries.map((query) => testEnv.DB.prepare(query)));
});

describe("browser-encrypted OTS", () => {
  it("serves strict, zero-third-party creation and reveal code", async () => {
    const result = await dispatch("/");
    const body = await result.text();
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(result.headers.get("Cache-Control")).toContain("no-transform");
    expect(result.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(result.headers.get("X-Frame-Options")).toBe("DENY");
    expect(body).toContain("Browser-encrypted. Server-blind. Reveal once.");
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).toContain('src="/assets/ots.js"');
  });
  it("reports healthy storage and owner-only acceptance", async () => {
    const result = await dispatch("/api/health");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, storage: "ready", acceptingSecrets: true, publicTrial: false });
  });
  it("keeps public creation disabled and unknown APIs closed", async () => {
    expect((await dispatch("/api/secrets")).status).toBe(404);
    expect((await dispatch("/api/secrets", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(404);
  });
  it("requires Cloudflare Access and a same-origin request for creation", async () => {
    const request = { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://ots.test" }, body: JSON.stringify({ ciphertext: "Y2lwaGVydGV4dA", iv: "MDEyMzQ1Njc4OWFi", expiresIn: 3600 }) };
    expect((await dispatch("/api/owner/secrets", request)).status).toBe(401);
    expect((await dispatch("/api/owner/secrets", {
      ...request,
      headers: { ...request.headers, Origin: "https://evil.test", "Cf-Access-Jwt-Assertion": "test-jwt" },
    })).status).toBe(403);
  });
  it("stores ciphertext and atomically consumes it exactly once", async () => {
    const created = await dispatch("/api/owner/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://ots.test",
        "Cf-Access-Jwt-Assertion": "test-jwt",
        "Cf-Access-Authenticated-User-Email": "owner@example.test",
        "CF-Connecting-IP": "192.0.2.10",
      },
      body: JSON.stringify({ ciphertext: "Y2lwaGVydGV4dA", iv: "MDEyMzQ1Njc4OWFi", expiresIn: 3600 }),
    });
    expect(created.status).toBe(201);
    const link = await created.json<{ id: string; claimToken: string }>();
    expect(link.id).toMatch(/^[\w-]{20,}$/);
    expect(link.claimToken).toMatch(/^[\w-]{40,}$/);
    const stored = await testEnv.DB.prepare("SELECT ciphertext, claim_token_hash FROM ots_secrets WHERE id=?").bind(link.id).first<{ ciphertext: string; claim_token_hash: string }>();
    expect(stored?.ciphertext).toBe("Y2lwaGVydGV4dA");
    expect(stored?.claim_token_hash).not.toBe(link.claimToken);
    const consume = () => dispatch(`/api/secrets/${link.id}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.20" },
      body: JSON.stringify({ claimToken: link.claimToken }),
    });
    const first = await consume();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ciphertext: "Y2lwaGVydGV4dA", iv: "MDEyMzQ1Njc4OWFi" });
    expect((await consume()).status).toBe(404);
  });
  it("fails closed when the owner creation interlock is disabled", async () => {
    const disabled = Object.assign(Object.create(enabledEnv), { OWNER_CREATION_ENABLED: "false" });
    const result = await dispatch("/api/health", undefined, disabled);
    expect(await result.json()).toMatchObject({ acceptingSecrets: false });
  });
  it("removes expired secret material and rate windows", async () => {
    const now = Date.now();
    await testEnv.DB.prepare("INSERT INTO ots_secrets (id,ciphertext,iv,claim_token_hash,mode,size_bytes,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind("expired", "ciphertext", "iv", "hash", "owner", 10, now - 20_000, now - 10_000).run();
    await testEnv.DB.prepare("INSERT INTO ots_rate_limit_windows (subject_hash,action,window_start,expires_at) VALUES (?,?,?,?)").bind("subject", "create", now - 20_000, now - 10_000).run();
    await cleanup(testEnv, now);
    expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM ots_secrets").first<{ count: number }>())?.count).toBe(0);
    expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM ots_rate_limit_windows WHERE subject_hash='subject'").first<{ count: number }>())?.count).toBe(0);
  });
});
