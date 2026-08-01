interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  OWNER_CREATION_ENABLED: string;
  PUBLIC_TRIAL_ENABLED: string;
  OTS_TOKEN_HMAC_SECRET?: string;
  OTS_IP_HASH_SECRET?: string;
  OTS_SESSION_SECRET?: string;
  TELEGRAM_OIDC_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const securityHeaders: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function response(body: BodyInit | null, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(body, { status, headers: { ...securityHeaders, "Content-Type": contentType } });
}

function json(body: unknown, status = 200) {
  return response(JSON.stringify(body), status, "application/json; charset=utf-8");
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow,noarchive"><title>One Time Secret — F12</title><link rel="stylesheet" href="/assets/ots.css"></head>
<body><a class="skip" href="#main">Skip to status</a><header class="mast"><span class="brand">F12</span><span>OTS / 001</span><span class="lock">Initialization locked</span></header>
<main id="main"><section class="hero" aria-labelledby="title"><p class="eyebrow">Controlled secret exchange</p><h1 id="title">One Time<br><span>Secret</span></h1><p class="lede">Browser-encrypted. Server-blind. Reveal once.</p><div class="notice" role="status"><i aria-hidden="true"></i>No secrets accepted yet.</div></section>
<section class="status" aria-labelledby="status-title"><h2 id="status-title">Deployment interlock</h2><dl><div><dt>Hostname</dt><dd>Reserved</dd></div><div><dt>Storage</dt><dd>Isolated</dd></div><div><dt>Owner create</dt><dd>Disabled</dd></div><div><dt>Public trial</dt><dd>Disabled</dd></div></dl><p>The service will open only after encryption, atomic reveal, expiry, access control, and abuse checks pass review.</p></section></main>
<footer><span>Zero plaintext by design</span><span>No analytics · No third-party code</span></footer></body></html>`;

const css = `:root{color-scheme:dark;--ink:#dbe6e3;--muted:#7b8c89;--void:#080b0b;--line:#25302e;--amber:#ffb000;--teal:#38d6b1}*{box-sizing:border-box}html{background:var(--void);font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;color:var(--ink)}body{min-height:100vh;margin:0;background-image:linear-gradient(rgba(56,214,177,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(56,214,177,.035) 1px,transparent 1px);background-size:32px 32px}.skip{position:fixed;left:1rem;top:-5rem;background:var(--amber);color:#080b0b;padding:.7rem 1rem;z-index:2}.skip:focus{top:1rem}.mast{height:64px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(1rem,4vw,4rem);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase}.brand{font:900 1.4rem/1 Arial Black,Impact,sans-serif;color:var(--amber)}.lock{justify-self:end;color:var(--muted)}.lock:before{content:"";display:inline-block;width:7px;height:7px;margin-right:.6rem;border-radius:50%;background:var(--amber);box-shadow:0 0 12px rgba(255,176,0,.7);animation:pulse 2s ease-in-out infinite}main{width:min(1180px,calc(100% - 2rem));min-height:calc(100vh - 128px);margin:auto;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);gap:1px;background:var(--line);border-inline:1px solid var(--line)}section{background:rgba(8,11,11,.95);padding:clamp(2rem,6vw,6rem)}.hero{display:flex;flex-direction:column;justify-content:center}.eyebrow,h2,dt{font-size:.68rem;letter-spacing:.16em;text-transform:uppercase}.eyebrow{color:var(--teal);margin:0 0 2rem}h1{margin:0;font:900 clamp(4.2rem,11vw,9.5rem)/.77 Arial Black,Impact,sans-serif;letter-spacing:-.07em;text-transform:uppercase}h1 span{color:transparent;-webkit-text-stroke:2px var(--ink)}.lede{max-width:32rem;margin:2.5rem 0;color:var(--muted);font-size:clamp(.9rem,1.5vw,1.1rem);line-height:1.7}.notice{width:max-content;max-width:100%;border:1px solid var(--amber);padding:.9rem 1.1rem;color:var(--amber);font-weight:700;text-transform:uppercase;font-size:.73rem;letter-spacing:.08em}.notice i{display:inline-block;width:8px;height:8px;background:var(--amber);margin-right:.75rem}.status{display:flex;flex-direction:column;justify-content:flex-end}.status h2{margin:0 0 2rem;color:var(--muted)}dl{margin:0;border-top:1px solid var(--line)}dl div{display:flex;justify-content:space-between;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--line)}dt{color:var(--muted)}dd{margin:0;color:var(--teal);font-size:.75rem;text-transform:uppercase}.status p{margin:2rem 0 0;color:var(--muted);font-size:.75rem;line-height:1.7}footer{min-height:64px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;padding:1rem clamp(1rem,4vw,4rem);color:var(--muted);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase}@keyframes pulse{50%{opacity:.3}}@media(max-width:760px){.mast{grid-template-columns:1fr 1fr}.lock{display:none}main{grid-template-columns:1fr}.hero{min-height:60vh}.status{min-height:40vh}footer{align-items:flex-start;flex-direction:column;gap:.5rem}}@media(prefers-reduced-motion:reduce){.lock:before{animation:none}}`;

async function health(env: Env) {
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: true, service: "f12-ots", environment: env.ENVIRONMENT, storage: "ready", acceptingSecrets: false });
  } catch {
    return json({ ok: false, service: "f12-ots", storage: "unavailable", acceptingSecrets: false }, 503);
  }
}

async function fetchHandler(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return response("Method not allowed", 405);
  if (url.pathname === "/api/health") return health(env);
  if (url.pathname.startsWith("/api/")) return json({ error: "Service initialization locked" }, 503);
  if (url.pathname === "/assets/ots.css") return response(css, 200, "text/css; charset=utf-8");
  if (url.pathname === "/robots.txt") return response("User-agent: *\nDisallow: /\n");
  if (url.pathname === "/" || url.pathname === "/create" || url.pathname === "/create/") return response(page, 200, "text/html; charset=utf-8");
  return response("Not found", 404);
}

async function cleanup(env: Env, now = Date.now()) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ots_secrets WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND consumed_at <= ?)").bind(now, now - 86_400_000),
    env.DB.prepare("DELETE FROM ots_rate_limit_windows WHERE expires_at <= ?").bind(now),
  ]);
}

export { cleanup };
export default { fetch: fetchHandler, async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(cleanup(env, controller.scheduledTime)); } } satisfies ExportedHandler<Env>;
