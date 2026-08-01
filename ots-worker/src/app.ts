import { createScript, homeScript, ownerScript } from "./asset-scripts";
import { createPage, detailPage, homePage, linksPage, policyPage as newPolicyPage, styles } from "./ui";

interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  OWNER_CREATION_ENABLED: string;
  PUBLIC_TRIAL_ENABLED: string;
  OTS_TOKEN_HMAC_SECRET?: string;
  OTS_IP_HASH_SECRET?: string;
  OTS_SESSION_SECRET?: string;
}

const encoder = new TextEncoder();
const EXPIRIES = new Set([900, 3600, 21_600, 86_400, 604_800]);
const securityHeaders: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0, no-transform",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer", "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow, noarchive",
};
function response(body: BodyInit | null, status = 200, type = "text/plain; charset=utf-8") { return new Response(body, { status, headers: { ...securityHeaders, "Content-Type": type } }); }
function json(body: unknown, status = 200) { return response(JSON.stringify(body), status, "application/json; charset=utf-8"); }

function configured(env: Env) { return env.OWNER_CREATION_ENABLED === "true" && Boolean(env.OTS_TOKEN_HMAC_SECRET && env.OTS_IP_HASH_SECRET && env.OTS_SESSION_SECRET); }
function b64(bytes: Uint8Array) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function random(size: number) { return b64(crypto.getRandomValues(new Uint8Array(size))); }
function required(value?: string) { if (!value) throw Error("OTS secret unavailable"); return value; }
async function hmac(keyValue: string, value: string) { const key = await crypto.subtle.importKey("raw", encoder.encode(keyValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))); }
function decodedSize(value: string) { return /^[\w-]+$/.test(value) ? Math.floor(value.length * 3 / 4) : -1; }
async function readBody(request: Request) { if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new Response("JSON required", { status: 415 }); try { return await request.json() as Record<string, unknown>; } catch { throw new Response("Invalid JSON", { status: 400 }); } }
async function rateLimit(env: Env, subject: string, action: string, seconds: number, max: number, now: number) { const start = Math.floor(now / (seconds * 1000)) * seconds * 1000; const row = await env.DB.prepare("INSERT INTO ots_rate_limit_windows(subject_hash,action,window_start,request_count,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(subject_hash,action,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count").bind(subject, action, start, 1, start + seconds * 1000).first<{ request_count: number }>(); if (!row || row.request_count > max) throw new Response("Rate limit exceeded", { status: 429 }); }
async function ownerIdentity(request: Request, env: Env) {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) return null;
  const identity = request.headers.get("Cf-Access-Authenticated-User-Email") || assertion;
  return hmac(required(env.OTS_SESSION_SECRET), `identity:${identity}`);
}
function fingerprint(id: string) { return `OTS-${id.slice(0, 6).toUpperCase()}…${id.slice(-4).toUpperCase()}`; }

async function health(env: Env) { try { await env.DB.prepare("SELECT 1").first(); return json({ ok: true, service: "f12-ots", environment: env.ENVIRONMENT, storage: "ready", acceptingSecrets: configured(env), publicTrial: false }); } catch { return json({ ok: false, storage: "unavailable", acceptingSecrets: false }, 503); } }
async function createOwner(request: Request, env: Env) {
  if (!configured(env)) return json({ error: "Owner creation is disabled." }, 503);
  const identityHash = await ownerIdentity(request, env);
  if (!identityHash) return json({ error: "Cloudflare Access authentication required." }, 401);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  const input = await readBody(request), ciphertext = typeof input.ciphertext === "string" ? input.ciphertext : "", iv = typeof input.iv === "string" ? input.iv : "", expiresIn = typeof input.expiresIn === "number" ? input.expiresIn : 0, passwordProtected = input.passwordProtected === true, size = decodedSize(ciphertext);
  if (size < 1 || size > 16_384 || decodedSize(iv) !== 12 || !EXPIRIES.has(expiresIn) || (input.passwordProtected !== undefined && typeof input.passwordProtected !== "boolean")) return json({ error: "Invalid encrypted payload or expiry." }, 400);
  const now = Date.now();
  await rateLimit(env, identityHash, "owner-create", 86_400, 80, now);
  const id = random(18), claimToken = random(32), claimHash = await hmac(required(env.OTS_TOKEN_HMAC_SECRET), `claim:${claimToken}`), ipHash = await hmac(required(env.OTS_IP_HASH_SECRET), `ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`);
  await env.DB.prepare("INSERT INTO ots_secrets(id,ciphertext,iv,claim_token_hash,mode,size_bytes,creator_ip_hash,creator_identity_hash,created_at,expires_at,password_protected) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id, ciphertext, iv, claimHash, "owner", size, ipHash, identityHash, now, now + expiresIn * 1000, passwordProtected ? 1 : 0).run();
  return json({ id, claimToken, expiresAt: now + expiresIn * 1000 }, 201);
}

type ActiveRow = { id: string; created_at: number; expires_at: number; size_bytes: number; password_protected: number };
type ReceiptRow = ActiveRow & { finalized_at: number; final_status: string; purge_after: number };
function activeItem(row: ActiveRow) {
  return { id: row.id, fingerprint: fingerprint(row.id), status: "active", createdAt: row.created_at, expiresAt: row.expires_at, sizeBytes: row.size_bytes, passwordProtected: Boolean(row.password_protected) };
}
function receiptItem(row: ReceiptRow) {
  return { id: row.id, fingerprint: fingerprint(row.id), status: row.final_status, createdAt: row.created_at, expiresAt: row.expires_at, finalizedAt: row.finalized_at, removeAt: row.purge_after, sizeBytes: row.size_bytes, passwordProtected: Boolean(row.password_protected) };
}
async function finalizeOwnerExpiry(env: Env, identityHash: string, now: number) {
  await env.DB.batch([
    env.DB.prepare("UPDATE ots_secrets SET deletion_reason='expired' WHERE creator_identity_hash=? AND status='ready' AND expires_at<=?").bind(identityHash, now),
    env.DB.prepare("DELETE FROM ots_secrets WHERE creator_identity_hash=? AND status='ready' AND expires_at<=?").bind(identityHash, now),
    env.DB.prepare("DELETE FROM ots_secret_receipts WHERE purge_after<=?").bind(now),
  ]);
}
async function listOwner(request: Request, env: Env) {
  const identityHash = await ownerIdentity(request, env), now = Date.now();
  if (!identityHash) return json({ error: "Cloudflare Access authentication required." }, 401);
  await finalizeOwnerExpiry(env, identityHash, now);
  const [active, receipts] = await Promise.all([
    env.DB.prepare("SELECT id,created_at,expires_at,size_bytes,password_protected FROM ots_secrets WHERE creator_identity_hash=? AND status='ready' AND expires_at>? ORDER BY created_at DESC LIMIT 200").bind(identityHash, now).all<ActiveRow>(),
    env.DB.prepare("SELECT id,created_at,expires_at,finalized_at,final_status,purge_after,size_bytes,password_protected FROM ots_secret_receipts WHERE creator_identity_hash=? AND purge_after>? ORDER BY created_at DESC LIMIT 200").bind(identityHash, now).all<ReceiptRow>(),
  ]);
  const items = [...active.results.map(activeItem), ...receipts.results.map(receiptItem)].sort((a, b) => b.createdAt - a.createdAt);
  return json({ now, items });
}
async function ownerDetail(request: Request, env: Env, id: string) {
  const identityHash = await ownerIdentity(request, env), now = Date.now();
  if (!identityHash) return json({ error: "Cloudflare Access authentication required." }, 401);
  await finalizeOwnerExpiry(env, identityHash, now);
  const active = await env.DB.prepare("SELECT id,created_at,expires_at,size_bytes,password_protected FROM ots_secrets WHERE id=? AND creator_identity_hash=? AND status='ready' AND expires_at>?").bind(id, identityHash, now).first<ActiveRow>();
  if (active) return json({ now, item: activeItem(active) });
  const receipt = await env.DB.prepare("SELECT id,created_at,expires_at,finalized_at,final_status,purge_after,size_bytes,password_protected FROM ots_secret_receipts WHERE id=? AND creator_identity_hash=? AND purge_after>?").bind(id, identityHash, now).first<ReceiptRow>();
  return receipt ? json({ now, item: receiptItem(receipt) }) : json({ error: "Link metadata is no longer available." }, 404);
}
async function deleteOwner(request: Request, env: Env, id: string) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  const identityHash = await ownerIdentity(request, env), now = Date.now();
  if (!identityHash) return json({ error: "Cloudflare Access authentication required." }, 401);
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE ots_secrets SET deletion_reason='revoked' WHERE id=? AND creator_identity_hash=? AND status='ready' AND expires_at>?").bind(id, identityHash, now),
    env.DB.prepare("DELETE FROM ots_secrets WHERE id=? AND creator_identity_hash=? AND status='ready' AND expires_at>?").bind(id, identityHash, now),
  ]);
  return Number(results[1].meta.changes || 0) > 0 ? json({ ok: true, status: "revoked" }) : json({ error: "Active link not found." }, 404);
}

async function consume(request: Request, env: Env, id: string) {
  if (!configured(env)) return json({ error: "Secret service unavailable." }, 503);
  const input = await readBody(request), claimToken = typeof input.claimToken === "string" ? input.claimToken : "";
  if (!/^[\w-]{20,64}$/.test(id) || !/^[\w-]{40,64}$/.test(claimToken)) return json({ error: "Secret unavailable or already revealed." }, 404);
  const now = Date.now(), ipHash = await hmac(required(env.OTS_IP_HASH_SECRET), `ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`);
  await rateLimit(env, ipHash, "consume", 3600, 120, now);
  const claimHash = await hmac(required(env.OTS_TOKEN_HMAC_SECRET), `claim:${claimToken}`);
  const payload = await env.DB.prepare("DELETE FROM ots_secrets WHERE id=? AND claim_token_hash=? AND status='ready' AND expires_at>? RETURNING ciphertext,iv").bind(id, claimHash, now).first<{ ciphertext: string; iv: string }>();
  return payload ? json(payload) : json({ error: "Secret unavailable or already revealed." }, 404);
}
async function fetchHandler(request: Request, env: Env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/health" && ["GET", "HEAD"].includes(request.method)) return await health(env);
    if (url.pathname === "/api/owner/secrets" && request.method === "GET") return await listOwner(request, env);
    if (url.pathname === "/api/owner/secrets" && request.method === "POST") return await createOwner(request, env);
    const ownerMatch = url.pathname.match(/^\/api\/owner\/secrets\/([\w-]{20,64})$/);
    if (ownerMatch && request.method === "GET") return await ownerDetail(request, env, ownerMatch[1]);
    if (ownerMatch && request.method === "DELETE") return await deleteOwner(request, env, ownerMatch[1]);
    const match = url.pathname.match(/^\/api\/secrets\/([\w-]+)\/consume$/);
    if (match && request.method === "POST") return await consume(request, env, match[1]);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    if (!["GET", "HEAD"].includes(request.method)) return response("Method not allowed", 405);
    if (["/ots.css", "/assets/ots.css"].includes(url.pathname)) return response(styles, 200, "text/css; charset=utf-8");
    if (["/create.js", "/assets/create.js"].includes(url.pathname)) return response(createScript, 200, "text/javascript; charset=utf-8");
    if (["/home.js", "/assets/home.js"].includes(url.pathname)) return response(homeScript, 200, "text/javascript; charset=utf-8");
    if (["/owner.js", "/assets/owner.js"].includes(url.pathname)) return response(ownerScript, 200, "text/javascript; charset=utf-8");
    if (url.pathname === "/robots.txt") return response("User-agent: *\nDisallow: /\n");
    const policy = newPolicyPage(url.pathname);
    if (policy) return response(policy, 200, "text/html; charset=utf-8");
    if (url.pathname === "/") return response(homePage, 200, "text/html; charset=utf-8");
    if (["/create", "/create/"].includes(url.pathname)) return response(createPage, 200, "text/html; charset=utf-8");
    if (["/create/links", "/create/links/"].includes(url.pathname)) return response(linksPage, 200, "text/html; charset=utf-8");
    const detailMatch = url.pathname.match(/^\/create\/links\/([\w-]{20,64})$/);
    return detailMatch ? response(detailPage(detailMatch[1]), 200, "text/html; charset=utf-8") : response("Not found", 404);
  } catch (error) {
    if (error instanceof Response) {
      if (error.status >= 500) console.error("OTS request failed", { status: error.status });
      return response("Request could not be processed.", error.status || 500);
    }
    console.error("OTS request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Service temporarily unavailable." }, 503);
  }
}
async function cleanup(env: Env, now = Date.now()) { await env.DB.batch([env.DB.prepare("UPDATE ots_secrets SET deletion_reason='expired' WHERE status='ready' AND expires_at<=?").bind(now), env.DB.prepare("DELETE FROM ots_secrets WHERE status='ready' AND expires_at<=?").bind(now), env.DB.prepare("DELETE FROM ots_secret_receipts WHERE purge_after<=?").bind(now), env.DB.prepare("DELETE FROM ots_rate_limit_windows WHERE expires_at<=?").bind(now)]); }
export { cleanup };
export default { fetch: fetchHandler, async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(cleanup(env, controller.scheduledTime)); } } satisfies ExportedHandler<Env>;
