# F12 One Time Secret

An isolated Cloudflare Worker for `ots.f12.biz`. The initial deployment is deliberately fail-closed: it reserves the hostname, verifies D1 and security headers, and does not accept secret material.

## Resources

- Worker: `f12-ots`
- D1: `ots-secrets-prod`
- Custom domain: `ots.f12.biz`
- Owner-only paths (future Access policy): `/create`, `/create/*`, `/api/owner/*`

## Deploy

```sh
npx wrangler d1 migrations apply ots-secrets-prod --local --config ots-worker/wrangler.toml
npx wrangler d1 migrations apply ots-secrets-prod --remote --config ots-worker/wrangler.toml
npx wrangler deploy --config ots-worker/wrangler.toml
```

The custom-domain route makes Cloudflare create and manage the DNS record and TLS certificate. Do not manually add an `ots` CNAME.

## Secrets

Wrangler prompts for each value without placing it in source control or the command line:

```sh
npx wrangler secret put OTS_TOKEN_HMAC_SECRET --config ots-worker/wrangler.toml
npx wrangler secret put OTS_IP_HASH_SECRET --config ots-worker/wrangler.toml
npx wrangler secret put OTS_SESSION_SECRET --config ots-worker/wrangler.toml
npx wrangler secret put TELEGRAM_OIDC_CLIENT_SECRET --config ots-worker/wrangler.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config ots-worker/wrangler.toml
```

The first three are internal random values and may be generated locally with `openssl rand -base64 48`. Telegram and Turnstile values must come from those providers. Never paste them into chat, a committed file, or a shell argument.

## Safety interlock

`OWNER_CREATION_ENABLED` and `PUBLIC_TRIAL_ENABLED` remain `false`. Enabling them before the reveal transaction, browser cryptography, expiry, rate limits, Telegram OIDC validation, and Access policy are implemented would be unsafe.
