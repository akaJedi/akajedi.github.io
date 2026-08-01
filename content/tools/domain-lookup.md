---
title: "Domain Health Inspector"
description: "Audit DNS and registration controls, then compare Cloudflare and Google resolver answers for propagation and DNSSEC differences."
searchDescription: "Standards-backed DNS health and resolver comparison for NS, DNSSEC, MX, SPF, DMARC, CAA, MTA-STS, and domain expiration."
layout: "domain-lookup"
toolScript: "js/tools/domain-lookup.js"
searchExclude: true
---

<section class="tool-card domain-inspector" aria-labelledby="tool-lookup-title">
  <div class="domain-inspector__heading">
    <div>
      <p class="domain-inspector__eyebrow">DNS / MAIL / DELEGATION</p>
      <h2 id="tool-lookup-title">Inspect a domain</h2>
    </div>
    <span class="domain-inspector__mode">Read-only · public data</span>
  </div>
  <form class="tool-form" data-domain-form>
    <label for="domain-input">Domain name</label>
    <div class="tool-form__row">
      <input id="domain-input" name="domain" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="example.com" required>
      <button type="submit">Run inspection</button>
    </div>
  </form>
  <p class="tool-error" data-domain-error role="alert" hidden></p>
  <p class="tool-hint" data-domain-loading role="status" hidden>Querying DNS and RDAP control points…</p>
</section>

<section class="domain-health" data-domain-health hidden tabindex="-1" aria-labelledby="domain-health-title" aria-live="polite">
  <header class="domain-health__header">
    <div>
      <p class="domain-inspector__eyebrow">Inspection result</p>
      <h2 id="domain-health-title"><span data-domain-result-name></span></h2>
      <p data-domain-verdict></p>
    </div>
    <div class="domain-health__signal" data-domain-signal aria-hidden="true"><span></span></div>
  </header>
  <dl class="domain-health__counts">
    <div data-count-status="critical"><dt>Critical</dt><dd data-count="critical">0</dd></div>
    <div data-count-status="warning"><dt>Warnings</dt><dd data-count="warning">0</dd></div>
    <div data-count-status="pass"><dt>Passed</dt><dd data-count="pass">0</dd></div>
    <div data-count-status="info"><dt>Advisory</dt><dd data-count="info">0</dd></div>
  </dl>
</section>

<section class="resolver-consensus" data-resolver-consensus hidden aria-labelledby="resolver-consensus-title">
  <header class="resolver-consensus__header">
    <div>
      <p class="domain-inspector__eyebrow">Resolver cross-check</p>
      <h2 id="resolver-consensus-title">Cloudflare ↔ Google</h2>
      <p data-consensus-verdict></p>
    </div>
    <span class="resolver-consensus__privacy">ECS 0.0.0.0/0 · privacy mode</span>
  </header>
  <dl class="resolver-consensus__counts">
    <div><dt>Matched</dt><dd data-consensus-count="match">0</dd></div>
    <div><dt>Different</dt><dd data-consensus-count="different">0</dd></div>
    <div><dt>DNSSEC</dt><dd data-consensus-count="dnssecDisagreement">0</dd></div>
    <div><dt>Unavailable</dt><dd data-consensus-count="unavailable">0</dd></div>
  </dl>
  <div class="resolver-consensus__viewport" tabindex="0" role="region" aria-label="Resolver comparison table">
    <table class="resolver-consensus__table">
      <thead><tr><th scope="col">Record</th><th scope="col">Cloudflare</th><th scope="col">Google</th><th scope="col">State</th></tr></thead>
      <tbody data-consensus-body></tbody>
    </table>
  </div>
</section>

<section class="domain-watch" data-domain-watch hidden aria-labelledby="domain-watch-title">
  <header class="domain-watch__header">
    <div>
      <p class="domain-inspector__eyebrow">Propagation watch</p>
      <h2 id="domain-watch-title">Follow one record for 24 hours</h2>
      <p>Capture a baseline now, then compare Cloudflare and Google every five minutes. The shareable timeline remains available for seven days after monitoring ends.</p>
    </div>
    <span class="domain-watch__cadence">05 MIN / 24 HR</span>
  </header>
  <form class="domain-watch__form" data-watch-form>
    <label for="domain-watch-record">Record to watch</label>
    <div>
      <select id="domain-watch-record" name="recordKey">
        <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>NS</option>
        <option>TXT</option><option>CAA</option><option>DS</option><option value="DMARC">DMARC</option><option value="MTA_STS">MTA-STS</option>
      </select>
      <button type="submit">Start 24-hour watch</button>
    </div>
    <p class="domain-watch__message" data-watch-message role="status"></p>
  </form>
  <div class="domain-watch__report" data-watch-report hidden>
    <div class="domain-watch__report-head">
      <div>
        <p class="domain-inspector__eyebrow">Incident timeline</p>
        <h3 data-watch-name></h3>
      </div>
      <div class="domain-watch__actions">
        <span data-watch-status></span>
        <button type="button" data-watch-share>Copy share link</button>
      </div>
    </div>
    <dl class="domain-watch__metrics">
      <div><dt>Samples</dt><dd data-watch-field="sampleCount">0</dd></div>
      <div><dt>Changes</dt><dd data-watch-field="changeCount">0</dd></div>
      <div><dt>Next sample</dt><dd data-watch-field="nextSampleAt">—</dd></div>
      <div><dt>Monitoring ends</dt><dd data-watch-field="expiresAt">—</dd></div>
    </dl>
    <ol class="domain-watch__timeline" data-watch-samples tabindex="0" role="region" aria-label="DNS propagation samples"></ol>
  </div>
</section>

<section class="domain-findings" data-domain-findings hidden aria-labelledby="domain-findings-title">
  <div class="domain-findings__heading">
    <h2 id="domain-findings-title">Control findings</h2>
    <p>Failures first. Each result includes the observed evidence, the operational consequence, and its governing specification.</p>
  </div>
  <div class="domain-findings__list" data-domain-findings-list></div>
</section>

<details class="domain-raw" data-domain-raw hidden>
  <summary>Raw DNS and registration evidence</summary>
  <section class="tool-card" data-domain-registration hidden aria-labelledby="tool-registration-title">
    <h2 id="tool-registration-title">Registration</h2>
    <dl class="tool-grid">
      <div><dt>RDAP lookup</dt><dd data-field="rdapLookup"></dd></div>
      <div><dt>Discovery path</dt><dd data-field="rdapSource"></dd></div>
      <div><dt>Registrar</dt><dd data-field="registrar"></dd></div>
      <div><dt>Registered</dt><dd data-field="registered"></dd></div>
      <div><dt>Expires</dt><dd data-field="expires"></dd></div>
      <div><dt>Last changed</dt><dd data-field="lastChanged"></dd></div>
      <div><dt>Status</dt><dd data-field="status"></dd></div>
      <div><dt>Nameservers</dt><dd data-field="nameservers"></dd></div>
    </dl>
    <p class="tool-hint" data-domain-registration-unavailable hidden>Registration data is unavailable for this TLD, or the RDAP lookup failed.</p>
  </section>

  <section class="tool-card" data-domain-dns hidden aria-labelledby="tool-dns-title">
    <h2 id="tool-dns-title">DNS records</h2>
    <dl class="tool-grid">
      <div><dt>A (IPv4)</dt><dd data-field="A"></dd></div>
      <div><dt>AAAA (IPv6)</dt><dd data-field="AAAA"></dd></div>
      <div><dt>CNAME</dt><dd data-field="CNAME"></dd></div>
      <div><dt>MX (mail)</dt><dd data-field="MX"></dd></div>
      <div><dt>NS (nameservers)</dt><dd data-field="NS"></dd></div>
      <div><dt>DS (DNSSEC)</dt><dd data-field="DS"></dd></div>
      <div><dt>SPF / other TXT</dt><dd data-field="TXT"></dd></div>
      <div><dt>DMARC</dt><dd data-field="DMARC"></dd></div>
      <div><dt>MTA-STS</dt><dd data-field="MTA_STS"></dd></div>
      <div><dt>CAA</dt><dd data-field="CAA"></dd></div>
    </dl>
  </section>
</details>

<p class="tools-note">The inspector compares Cloudflare and Google DNS-over-HTTPS answers, requests Google results without client-subnet localization, and discovers registration data through RDAP. It never connects to the inspected domain or scans ports. One-time inspection results are not stored; when you explicitly start a watch, its public DNS observations are retained for up to eight days and then automatically removed. “Advisory” means optional hardening, not a broken configuration. Findings reference <a href="https://www.rfc-editor.org/rfc/rfc2182.html">RFC 2182</a>, <a href="https://www.rfc-editor.org/rfc/rfc4035.html">RFC 4035</a>, <a href="https://www.rfc-editor.org/rfc/rfc7208.html">RFC 7208</a>, <a href="https://www.rfc-editor.org/rfc/rfc9989.html">RFC 9989</a>, and related standards.</p>
