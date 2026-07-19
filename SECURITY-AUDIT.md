# Website Chat Security Review

Date: 2026-07-19
Scope: repository, Cloudflare Worker code, production HTTP behavior, and the public website chat surface.
Method: non-destructive review only; no credential guessing, high-volume scanning, destructive requests, or data modification.

## Executive summary

No critical or high-severity issue was found in this review. The dependency audit reported zero vulnerabilities, no credential files or private-key patterns are tracked, and the chat API uses server-side validation, parameterized D1 queries, hashed session/IP values, rate limits, Turnstile validation, and Telegram webhook authentication.

## Findings

### M-01 — Production security headers are not consistently present

The GitHub Pages response did not expose a Content-Security-Policy, Strict-Transport-Security, Referrer-Policy, or Permissions-Policy header in the tested response. This is a defense-in-depth gap, not an immediate data-access vulnerability.

Recommendation: configure these headers at Cloudflare (Transform Rules/Managed Response Headers) or the hosting edge. Preserve Turnstile requirements: `script-src` and `frame-src` must allow `https://challenges.cloudflare.com`, and `connect-src` must allow the Worker and Turnstile.

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
