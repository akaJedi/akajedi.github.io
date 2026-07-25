# Website Chat Security Review

Date: 2026-07-19 (see update below)
Scope: repository, Cloudflare Worker code, production HTTP behavior, and the public website chat surface.
Method: non-destructive review only; no credential guessing, high-volume scanning, destructive requests, or data modification.

## Update — 2026-07-25

Two findings below are now stale relative to work merged since the original review date. Original text is left intact for the audit trail; this note reflects current reality.

- **M-01 is now partially resolved.** GitHub Pages still cannot serve custom HTTP response headers, so `X-Frame-Options`, `Strict-Transport-Security`, and `X-Content-Type-Options` remain genuinely unreachable for the primary `www.f12.biz` domain — that is a hosting-platform limit, not an open gap. However, `Content-Security-Policy` and `Referrer-Policy` are now set via `<meta>` in `layouts/partials/head.html` (the only mechanism GitHub Pages allows), and the full header set (including the headers meta tags can't express) is applied via `static/_headers` on the Netlify/Cloudflare Pages mirrors, where real HTTP headers are achievable. Getting the CSP right for a site with three live deployment domains (canonical + two mirrors) plus several third-party integrations (Cookiebot, Turnstile, Metricool, Google Analytics) took several iterations — see `ROADMAP.md` for the current state and open considerations.
- **Dependency audit is no longer clean.** `npm audit --audit-level=moderate` currently reports 4 high-severity findings, all `sharp`/`libvips` CVEs pulled in transitively via `miniflare` → `wrangler` → `@cloudflare/vitest-pool-workers` (a dev-only dependency chain used solely by the local/CI worker test pool — not present in the deployed Worker or the static site). Re-run `npm audit` and re-check this before relying on the original "0 vulnerabilities" claim.

## Findings

### M-01 — Production security headers are not consistently present

The GitHub Pages response did not expose a Content-Security-Policy, Strict-Transport-Security, Referrer-Policy, or Permissions-Policy header in the tested response. This is a defense-in-depth gap, not an immediate data-access vulnerability.

Recommendation: configure these headers at Cloudflare (Transform Rules/Managed Response Headers) or the hosting edge. Preserve Turnstile requirements: `script-src` and `frame-src` must allow `https://challenges.cloudflare.com`, and `connect-src` must allow the Worker and Turnstile.

*(See "Update — 2026-07-25" above — CSP/Referrer-Policy are now addressed for `www.f12.biz`; HSTS/X-Frame-Options/X-Content-Type-Options remain a GitHub Pages platform limit.)*

### L-01 — Local diagnostics endpoint is intentionally local-only

`/api/chat/dev-status` is rejected unless the request hostname is localhost/127.0.0.1/::1. Production access returned no diagnostic data. Keep this restriction and do not expose it through a public route.

### L-02 — Full IP addresses are not stored in D1

The application stores one-way IP hashes and user-agent summaries. This limits forensic detail but reduces privacy and breach impact. Cloudflare Security Events remain the source for edge-level IP/WAF investigation.

## Checks completed

- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Repository secret-pattern scan: no tracked `.env`, `.dev.vars`, private-key, Telegram-token, or credential-file matches.
- `npm run check`: 50 tests passed.
- `npm run build`: passed.
- CORS preflight for production draft `PUT`: allowed only for configured origins and required headers.
- Endpoint review: no public conversation-list endpoint; conversation operations require session authorization.
- Webhook review: Telegram secret header and admin-chat validation are enforced; duplicate updates are persisted/idempotently handled.

## Recommended ongoing monitoring

- Review Cloudflare Security Events for blocked scans and WAF events.
- Use `npx wrangler tail green-rice-1ea7` for deployed Worker errors.
- Review D1 callback/conversation records for leads and abuse patterns.
- Keep Worker secrets only in Cloudflare and local `.dev.vars` (never commit `.dev.vars`).
- Re-run dependency and secret scans before significant releases.
