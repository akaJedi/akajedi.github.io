---
title: "Domain Lookup"
description: "Look up a domain's DNS records and registration details in one place — A/AAAA/MX/NS/TXT/CAA records plus registrar, creation, and expiration dates."
searchDescription: "DNS and domain registration lookup: A, AAAA, MX, NS, TXT, CAA records and RDAP registration data for any domain."
layout: "domain-lookup"
toolScript: "js/tools/domain-lookup.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-lookup-title">
  <h2 id="tool-lookup-title">Look up a domain</h2>
  <form class="tool-form" data-domain-form>
    <label for="domain-input">Domain name</label>
    <div class="tool-form__row">
      <input id="domain-input" name="domain" type="text" autocomplete="off" spellcheck="false" placeholder="example.com">
      <button type="submit">Look up</button>
    </div>
  </form>
  <p class="tool-error" data-domain-error hidden></p>
  <p class="tool-hint" data-domain-loading hidden>Looking up…</p>
</section>

<section class="tool-card" data-domain-registration hidden aria-labelledby="tool-registration-title">
  <h2 id="tool-registration-title">Registration</h2>
  <dl class="tool-grid">
    <div><dt>Registrar</dt><dd data-field="registrar"></dd></div>
    <div><dt>Registered</dt><dd data-field="registered"></dd></div>
    <div><dt>Expires</dt><dd data-field="expires"></dd></div>
    <div><dt>Last changed</dt><dd data-field="lastChanged"></dd></div>
    <div><dt>Status</dt><dd data-field="status"></dd></div>
    <div><dt>Nameservers</dt><dd data-field="nameservers"></dd></div>
  </dl>
  <p class="tool-hint" data-domain-registration-unavailable hidden>Registration data isn't available for this domain's TLD, or the lookup failed. Not every registry runs a public RDAP server.</p>
</section>

<section class="tool-card" data-domain-dns hidden aria-labelledby="tool-dns-title">
  <h2 id="tool-dns-title">DNS records</h2>
  <dl class="tool-grid">
    <div><dt>A (IPv4)</dt><dd data-field="A"></dd></div>
    <div><dt>AAAA (IPv6)</dt><dd data-field="AAAA"></dd></div>
    <div><dt>MX (mail)</dt><dd data-field="MX"></dd></div>
    <div><dt>NS (nameservers)</dt><dd data-field="NS"></dd></div>
    <div><dt>TXT</dt><dd data-field="TXT"></dd></div>
    <div><dt>CAA</dt><dd data-field="CAA"></dd></div>
  </dl>
</section>

<p class="tools-note">Uses DNS-over-HTTPS (Cloudflare's public resolver) for records and <a href="https://rdap.org">RDAP</a> — the modern, standardized replacement for WHOIS — for registration data. Both are independent public registries; looking up a domain here never makes this site contact that domain's own servers at all. Nothing about your lookup is stored.</p>
