# Architecture & quality audit — improvement backlog

Date: 2026-07-25
Scope: repository architecture, deployment posture, CI/CD, dependencies, and documentation accuracy. Complements [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md), which covers the chat/contact security surface specifically.
Method: read-through of source, config, CI workflows, and test coverage; no production data was read or modified.

Items are ordered by priority within each tier. Each one names the exact file(s) involved so it can be picked up without re-deriving context.

## High priority

### 1. Finish the already-scoped retention cleanup

`src/retention.ts` exports `isEligibleForRetentionCleanup()`, a fully implemented and unit-tested (`tests/retention.worker.test.ts`) eligibility check for deleting closed/spam conversations after `CLOSED_RETENTION_DAYS`/`SPAM_RETENTION_DAYS`. It is **not called anywhere** — the `scheduled()` cron handler in `src/worker.ts` only cleans up `rate_limit_windows`, `telegram_updates`, and `telegram_outbox` on a fixed 30-day window.

This is not an oversight: the README's "Privacy, security, and retention" section explicitly documents this as intentional — "Automatic deletion is intentionally disabled. Retention eligibility must remain tested before any future cleanup command or scheduled deletion is introduced." The hard part (correct, tested eligibility logic) is done; what's left is a scoped, well-understood next step:

1. In `scheduled()`, query `conversations` where `status IN ('closed', 'spam')` and `closed_at` passes `isEligibleForRetentionCleanup()`.
2. Delete matching rows from `conversations`, cascading to `messages`, `callback_requests`, `telegram_message_map`, and `conversation_drafts` for those conversation IDs.
3. Add a test that seeds an eligible and an ineligible conversation and asserts only the eligible one is removed.

Worth doing soon because `content/privacy.md` currently tells visitors "Closed and spam records are retained according to the configured retention policy" — read literally, that implies deletion already happens. Until this is wired in, consider softening that wording slightly (e.g., "governed by a documented retention policy, currently being finalized") so the policy text matches actual behavior in the meantime.

**This touches real production lead data on an irreversible (delete) code path — implement behind a dry-run/log-only mode first, verify against production D1 read-only queries, and get explicit sign-off before enabling actual deletion.**

### 2. Re-run and refresh the dependency/security audit periodically

`npm audit --audit-level=moderate` currently reports 4 high-severity findings (`sharp`/`libvips` CVEs via `miniflare` → `wrangler` → `@cloudflare/vitest-pool-workers`), contradicting `SECURITY-AUDIT.md`'s original "0 vulnerabilities" claim from 2026-07-19 (dependencies have since drifted). The exposure is dev-only — this chain only runs in the local/CI worker test pool, never in the deployed Worker or the static site — but it should be tracked: re-run `npm audit fix` when a compatible `wrangler`/`@cloudflare/vitest-pool-workers` release is available, and re-audit before any significant release. (`SECURITY-AUDIT.md` has been updated with a note reflecting this.)

## Medium priority

### 3. GitHub Actions pinning — now consistent, keep it that way

`deploy.yml`, `regression-tests.yml`, and `update-resumes.yml` all now pin every action (first- and third-party) to a commit SHA with a version comment, rather than a mutable tag. When bumping a version, resolve the new tag's commit SHA (`gh api repos/<owner>/<repo>/git/refs/tags/<tag>`, dereferencing an annotated tag object if `type` is `"tag"` rather than `"commit"`) and update both the SHA and the version comment together — don't let the comment drift from the actual pinned commit.

### 4. Automated i18n-completeness check

Three RU pages (`/skills`, `/search`, one `/experience/` entry) were 404ing or silently incomplete because their `.ru.md` translation file simply never existed — found by manual diffing during this session, not by any test. Added `tests/site-regression.test.mjs`'s "every Russian nav menu URL resolves to a real page in the build" test, which parses `hugo.toml`'s `[languages.ru.menus]` block and asserts every `/ru/...` URL it lists produces a real page in the production build. This catches the exact failure mode that happened (a nav-linked page missing its translation) but won't catch a page that's *reachable via an in-content link* but not in the nav menus — acceptable for now given nav/footer links are the highest-traffic paths, but worth widening if more translation gaps turn up.

### 5. Domain feature-parity is now documented — keep the table current

`README.md`'s "What works on which domain" table now records what's deliberately domain-gated (Cookiebot) versus universal (Turnstile, the chat API, security headers via `_headers`). When adding a new third-party integration, update that table in the same PR — this exact gap (assuming mirrors behave identically to the canonical domain) caused several rounds of console-error debugging this session (absolute asset URLs breaking mirrors, Cookiebot's per-domain authorization, CSP directives missing mirror-only script/frame/image sources).

## Low priority / cleanup

### 6. `hugo.disablemenu.toml` — removed

Was an orphaned, unreferenced config file (not loaded by any Hugo command, npm script, or CI workflow) containing `params.languages.selector.disable`/`params.colorTheme.selector.disable` keys that no longer exist in `hugo.toml` after the language/theme-selector rework. Deleted as part of this audit.

### 7. Confirm `update-resumes.yml`'s direct-push-to-main is intentional

That workflow pushes directly to `main` from CI (`git push` after committing `data/resumes.yaml` updates), bypassing the repository ruleset's PR-review requirement the same way an admin's manual bypass would. This is very likely deliberate (fully automated metadata regeneration, not a content/behavior change), but it's worth a one-line comment in the workflow file confirming that, so a future reader doesn't mistake it for an accidental gap in branch protection.

## Out of scope for this pass

- A full manual accessibility/performance re-audit — the PageSpeed-driven fixes from earlier this session (contrast, landmarks, touch targets, render-blocking CSS) addressed the specific findings from that report; a fresh Lighthouse run would be the right way to check for new regressions or previously-unflagged issues, rather than guessing at what might have changed.
- SSO/OAuth login for the chat widget — discussed separately; worth scoping only once the actual motivating problem (spam reduction vs. friction vs. verified contact info) is picked.
