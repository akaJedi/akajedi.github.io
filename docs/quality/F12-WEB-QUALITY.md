# F12 Web Quality Baseline and Audit Plan

Status: planned; automation not implemented yet  
Recorded: 2026-08-01

## Purpose

Turn deployment-time SEO and Lighthouse results into durable, version-controlled
quality evidence. The checks should catch regressions, explain why a deployment
failed, and leave enough history to guide future improvements.

## Current repository state

- CI runs the Node regression suite and Hugo production build.
- Hugo generates `robots.txt` and `sitemap.xml`.
- The site has title and description metadata in the shared head partial.
- No Lighthouse CI configuration is currently tracked.
- No current CI job stores Lighthouse HTML/JSON reports or compares scores with
  an accepted baseline.
- Existing site regression tests do not provide a complete SEO audit.

## Required tracked files

The intended implementation should add:

- `lighthouserc.cjs` — URLs, collection settings, assertions, and budgets.
- `tools/validate-seo.mjs` — deterministic checks that do not depend on network
  conditions.
- `docs/quality/LIGHTHOUSE-BASELINE.md` — accepted scores, measurement date,
  tested URLs, environment, and notable exceptions.
- `docs/quality/IMPROVEMENTS.md` — dated regressions, fixes, and measured gains.
- A GitHub Actions workflow or steps in the existing regression workflow that
  build and serve the production site, run both audits, publish a job summary,
  and upload full reports as artifacts.

Generated Lighthouse reports must not be committed on every run. Keep the
configuration, accepted baseline, and human-readable history in Git; retain raw
HTML/JSON reports as GitHub Actions artifacts.

## Deterministic SEO deployment gates

A deployment must fail for:

- a missing or incorrect canonical URL;
- a missing page title, meta description, or primary heading;
- duplicate canonical URLs for independently indexable pages;
- broken internal links or missing local assets;
- production pages accidentally marked `noindex`;
- sitemap URLs that do not resolve to published pages;
- a missing production sitemap declaration in `robots.txt`;
- invalid language declarations or broken alternate-language links where used;
- missing alternative text on meaningful images;
- invalid structured data when structured data is present.

Document intentional exceptions next to the validator configuration. Do not
silently weaken a check to make CI green.

## Initial Lighthouse policy

Measure both the home page and representative content/tool pages. Establish the
first accepted baseline from the median of at least three production-mode runs.
Until that baseline is recorded, use these provisional deployment floors:

| Category | Improvement target | Deployment floor |
| --- | ---: | ---: |
| SEO | 100 | 95 |
| Accessibility | 95 | 90 |
| Best Practices | 95 | 90 |
| Performance | 90 | 80 |

Track these lab signals in the baseline even when they are not immediate hard
gates:

- Largest Contentful Paint: target at most 2.5 seconds;
- Cumulative Layout Shift: target at most 0.10;
- Total Blocking Time: target at most 200 milliseconds.

Lighthouse performance results are noisy. A single small score change should
not block deployment. Prefer median runs and block only when the deployment
floor is crossed or a sustained regression is confirmed.

## CI result routing

Every audit run should produce:

1. A concise GitHub Actions job summary with scores and pass/fail reasons.
2. Full Lighthouse HTML and JSON artifacts for investigation.
3. Machine-readable SEO validator output when a check fails.
4. A PR-visible failed check for deployment-blocking regressions.

Do not automatically commit measured scores from an untrusted pull request.
Update the accepted baseline deliberately after reviewing a real improvement or
an explained environmental change.

## Continuation checklist

1. Add Lighthouse CI as a pinned development dependency.
2. Add the deterministic SEO validator and focused tests.
3. Select representative F12 URLs for mobile and desktop measurements.
4. Add CI collection, assertions, job summary, and artifact upload.
5. Run the first baseline locally and in CI.
6. Record the accepted values in `LIGHTHOUSE-BASELINE.md`.
7. Require the audit check before deployment.

## Publishing safety checkpoint

At the time this plan was recorded, the working branch was
`agent/ots-owner-mvp` and contained separate, uncommitted OTS implementation
work. The branch had no committed changes ahead of its remote. Do not deploy or
commit the entire working tree merely to publish this plan; finish and verify
the OTS work independently, then place quality automation on an appropriately
scoped branch or commit.
