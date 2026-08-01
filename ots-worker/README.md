# F12 One Time Secret

An isolated Cloudflare Worker for browser-encrypted, single-reveal links at `ots.f12.biz`.

## Use

1. Open `https://ots.f12.biz/create` and authenticate through Cloudflare Access.
2. Enter text, choose an expiry, and optionally require a separate password.
3. Create the link. This is the only screen and moment where the complete link is available.
4. Send the complete link through a trusted channel. Send an optional password through a different channel.
5. The recipient selects **Reveal secret**. The encrypted D1 row is atomically deleted before browser-side decryption.

Owner actions are deliberately separated:

- `/create` creates a new link.
- `/create/links` lists active and recently finished metadata.
- `/create/links/{id}` shows one metadata record and, while active, its delete action.

The history never recovers or displays a full URL, claim token, password, encryption key, ciphertext, or IV. After reveal, expiry, or owner deletion, only a safe status receipt remains for up to 24 hours.

The complete link is a bearer secret, similar to a password: anyone who obtains it can decrypt and consume the message. The creation form requires an explicit acknowledgment of this boundary. User education is available at `/safety`, `/privacy`, and `/terms`; keep those pages aligned with the implementation whenever storage, authentication, logging, retention, or public access changes.

The browser generates a random 256-bit AES-GCM content key. Only ciphertext and its IV reach the Worker. Version 1 links carry the content key in the URL fragment. Version 2 links wrap that random key using AES-GCM and a key derived from the separate password with PBKDF2-HMAC-SHA-256 (600,000 iterations). Passwords, derived keys, and fragment values are never sent or stored.

The Worker receives the claim token only when the recipient explicitly reveals the secret, compares its HMAC, and deletes the matching unexpired row with `DELETE ... RETURNING`. For a password-protected link, the browser verifies and unwraps the key before making that consume request, so a wrong password does not consume the secret. Version 1 links remain supported.

A password-protected fragment can be copied and guessed offline, so PBKDF2 only slows guessing; it cannot make a weak password safe. Use a strong, unique password of at least 12 characters.

Owner creation is limited to 80 links per UTC-aligned 24-hour rate window. Public creation remains disabled. Reveal attempts are rate-limited by an HMAC of the connecting IP; raw IPs and plaintext are not stored.

## Resources

- Worker: `f12-ots`
- D1: `ots-secrets-prod`
- Custom domain: `ots.f12.biz`
- Owner-only Access paths: `/create` and `/api/owner` (child paths inherit each policy)
- Owner identity: the HMAC of the identity asserted by Cloudflare Access

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
```

These are internal random values and may be generated locally with `openssl rand -base64 48`. Never paste them into chat, a committed file, or a shell argument.

Telegram authentication and a public trial are intentionally outside this owner-only release. Add either behind a separate policy and threat-model review rather than weakening the existing Access boundary.

## Safety interlock

`OWNER_CREATION_ENABLED` may be `true` only while both Access destinations are active:

- `/create` (including child paths)
- `/api/owner` (including child paths)

`PUBLIC_TRIAL_ENABLED` remains `false`. A public trial requires a separate abuse-control and budget review; do not reuse the owner policy as a public policy.

The current terms are marked as a practical beta draft. Obtain jurisdiction-specific legal review before enabling a public trial or presenting them as binding production terms.
