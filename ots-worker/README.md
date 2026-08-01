# F12 One Time Secret

An isolated Cloudflare Worker for browser-encrypted, single-reveal links at `ots.f12.biz`.

## Use

1. Open `https://ots.f12.biz/create` and authenticate through Cloudflare Access.
2. Enter text, choose an expiry, and create the one-time link.
3. Send the complete link to the recipient through a trusted channel.
4. The recipient selects **Reveal secret**. The encrypted D1 row is atomically deleted before browser-side decryption.

The browser generates a 256-bit AES-GCM key. Only ciphertext and its IV reach the Worker. The identifier, claim token, and key are encoded into the URL fragment; browsers do not send the fragment to the server. The Worker receives the claim token only when the recipient explicitly reveals the secret, compares its HMAC, and deletes the matching unexpired row with `DELETE ... RETURNING`.

Owner creation is limited to 80 links per UTC-aligned 24-hour rate window. Public creation remains disabled. Reveal attempts are rate-limited by an HMAC of the connecting IP; raw IPs and plaintext are not stored.

## Resources

- Worker: `f12-ots`
- D1: `ots-secrets-prod`
- Custom domain: `ots.f12.biz`
- Owner-only Access paths: `/create` and `/api/owner` (child paths inherit each policy)

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

`OWNER_CREATION_ENABLED` may be `true` only while both Access destinations are active:

- `/create` (including child paths)
- `/api/owner` (including child paths)

`PUBLIC_TRIAL_ENABLED` remains `false`. A public trial requires a separate abuse-control and budget review; do not reuse the owner policy as a public policy.
