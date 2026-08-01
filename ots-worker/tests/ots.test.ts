/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import worker, { cleanup } from "../src/app";
import migrationSql from "../migrations/0001_ots.sql?raw";
import ownerHistorySql from "../migrations/0002_owner_history.sql?raw";
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
const ownerHeaders = (email = "owner@example.test") => ({
  "Content-Type": "application/json",
  Origin: "https://ots.test",
  "Cf-Access-Jwt-Assertion": "test-jwt",
  "Cf-Access-Authenticated-User-Email": email,
  "CF-Connecting-IP": "192.0.2.10",
});
async function createOwnerSecret(passwordProtected = false, email = "owner@example.test") {
  const result = await dispatch("/api/owner/secrets", {
    method: "POST",
    headers: ownerHeaders(email),
    body: JSON.stringify({ ciphertext: "Y2lwaGVydGV4dA", iv: "MDEyMzQ1Njc4OWFi", expiresIn: 3600, passwordProtected }),
  });
  expect(result.status).toBe(201);
  return result.json<{ id: string; claimToken: string }>();
}

beforeAll(async () => {
  const triggerAt = ownerHistorySql.indexOf("CREATE TRIGGER");
  const statements = `${migrationSql}\n${ownerHistorySql.slice(0, triggerAt)}`.split(";").map((query) => query.trim()).filter(Boolean);
  await testEnv.DB.batch(statements.map((query) => testEnv.DB.prepare(query)));
  await testEnv.DB.prepare(ownerHistorySql.slice(triggerAt).trim()).run();
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
    expect(body).toContain("Send a secret without storing plaintext");
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).toContain('src="/home.js"');
  });
  it("emits a fragment parser that accepts generated base64url parts", async () => {
    const browserScript = await dispatch("/home.js").then((result) => result.text());
    expect(browserScript).toContain("/^#v1[.]([A-Za-z0-9_-]{20,64})[.]([A-Za-z0-9_-]{40,64})[.]([A-Za-z0-9_-]{40,64})$/");
    expect(browserScript).toContain("/^#v2[.]");
    expect(browserScript).toContain("const PBKDF2_ITERATIONS = 600000");
    expect(browserScript.indexOf("crypto.subtle.decrypt(")).toBeLessThan(browserScript.indexOf('fetch("/api/secrets/"'));
    expect(browserScript).toContain("Password is incorrect. The secret was not consumed.");
    expect(browserScript).not.toContain("([w-]");
  });
  it("keeps create, history, and delete actions on separate views", async () => {
    const create = await dispatch("/create").then((result) => result.text());
    const links = await dispatch("/create/links").then((result) => result.text());
    const detail = await dispatch("/create/links/abcdefghijklmnopqrstuvwx").then((result) => result.text());
    expect(create).toContain('id="create-form"');
    expect(create).not.toContain('id="links-list"');
    expect(create).not.toContain('id="delete-link"');
    expect(links).toContain('id="links-list"');
    expect(links).not.toContain('id="create-form"');
    expect(links).not.toContain('id="delete-link"');
    expect(detail).toContain('id="delete-link"');
    expect(detail).not.toContain('id="create-form"');
    expect(detail).not.toContain('id="links-list"');
    expect(create).not.toMatch(/font:900 clamp\(4/);
  });
  it("teaches users that the complete link is a bearer secret", async () => {
    const body = await dispatch("/create").then((result) => result.text());
    expect(body).toContain("full link is sensitive");
    expect(body).toContain('id="bearer-ack" type="checkbox" required');
    expect(body).toContain('href="/create/links"');
    expect(body).not.toContain('id="links-list"');
  });
  it.each([
    ["/safety", "Safe handling"],
    ["/privacy", "Privacy & security"],
    ["/terms", "Beta terms"],
  ])("serves the public education page %s", async (path, heading) => {
    const result = await dispatch(path);
    const body = await result.text();
    expect(result.status).toBe(200);
    expect(body).toContain(heading);
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).not.toContain("<script");
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
  it("keeps owner metadata private and never returns recoverable material", async () => {
    const link = await createOwnerSecret(true);
    const ownerResult = await dispatch("/api/owner/secrets", { headers: ownerHeaders() });
    const otherResult = await dispatch("/api/owner/secrets", { headers: ownerHeaders("other@example.test") });
    const ownerText = await ownerResult.text();
    expect(ownerResult.status).toBe(200);
    expect(ownerText).toContain(link.id);
    expect(ownerText).toContain('"passwordProtected":true');
    expect(ownerText).not.toContain(link.claimToken);
    expect(ownerText).not.toContain("Y2lwaGVydGV4dA");
    expect(ownerText).not.toContain("MDEyMzQ1Njc4OWFi");
    expect(await otherResult.json()).toMatchObject({ items: [] });
  });
  it("retains only a 24-hour safe receipt after reveal", async () => {
    const link = await createOwnerSecret();
    const consumed = await dispatch(`/api/secrets/${link.id}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.20" },
      body: JSON.stringify({ claimToken: link.claimToken }),
    });
    expect(consumed.status).toBe(200);
    const detail = await dispatch(`/api/owner/secrets/${link.id}`, { headers: ownerHeaders() });
    const detailText = await detail.text();
    expect(detail.status).toBe(200);
    expect(detailText).toContain('"status":"consumed"');
    expect(detailText).not.toContain(link.claimToken);
    expect(detailText).not.toContain("Y2lwaGVydGV4dA");
    const receipt = await testEnv.DB.prepare("SELECT final_status,finalized_at,purge_after FROM ots_secret_receipts WHERE id=?").bind(link.id).first<{ final_status: string; finalized_at: number; purge_after: number }>();
    expect(receipt?.final_status).toBe("consumed");
    expect((receipt?.purge_after || 0) - (receipt?.finalized_at || 0)).toBe(86_400_000);
  });
  it("lets only the owner revoke an active payload", async () => {
    const link = await createOwnerSecret();
    expect((await dispatch(`/api/owner/secrets/${link.id}`, {
      method: "DELETE",
      headers: ownerHeaders("other@example.test"),
    })).status).toBe(404);
    expect((await dispatch(`/api/owner/secrets/${link.id}`, {
      method: "DELETE",
      headers: ownerHeaders(),
    })).status).toBe(200);
    const receipt = await testEnv.DB.prepare("SELECT final_status FROM ots_secret_receipts WHERE id=?").bind(link.id).first<{ final_status: string }>();
    expect(receipt?.final_status).toBe("revoked");
    expect(await testEnv.DB.prepare("SELECT ciphertext FROM ots_secrets WHERE id=?").bind(link.id).first()).toBeNull();
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
    expect(await testEnv.DB.prepare("SELECT id FROM ots_secrets WHERE id='expired'").first()).toBeNull();
    expect((await testEnv.DB.prepare("SELECT COUNT(*) count FROM ots_rate_limit_windows WHERE subject_hash='subject'").first<{ count: number }>())?.count).toBe(0);
    expect((await testEnv.DB.prepare("SELECT final_status FROM ots_secret_receipts WHERE id='expired'").first<{ final_status: string }>())?.final_status).toBe("expired");
    await cleanup(testEnv, now + 86_401_000);
    expect(await testEnv.DB.prepare("SELECT id FROM ots_secret_receipts WHERE id='expired'").first()).toBeNull();
  });
});
