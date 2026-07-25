---
title: "Connection & Browser Check"
description: "See exactly what your connection and browser expose to this site — IP, approximate location, network, TLS, and a live WebRTC/fingerprint leak test."
searchDescription: "Check your IP, ISP, TLS version, and whether WebRTC or canvas fingerprinting can leak information about you."
layout: "connection-check"
toolScript: "js/tools/connection-check.js"
searchExclude: true
---

<p class="tools-note">Everything on this page is either computed directly in your own browser, or read from information Cloudflare's network already sees for every request it handles. Nothing here is stored, logged, or sent anywhere beyond this one request — you're only seeing your own data, echoed back to you.</p>

<section class="tool-card" aria-labelledby="tool-network-title">
  <h2 id="tool-network-title">Your network</h2>
  <dl class="tool-grid" data-tool-network>
    <div><dt>IP address</dt><dd data-field="ip">Checking…</dd></div>
    <div><dt>Address family</dt><dd data-field="protocolFamily">Checking…</dd></div>
    <div><dt>Provider (ASN)</dt><dd data-field="organization">Checking…</dd></div>
    <div><dt>HTTP protocol</dt><dd data-field="httpProtocol">Checking…</dd></div>
    <div><dt>TLS version</dt><dd data-field="tlsVersion">Checking…</dd></div>
    <div><dt>Cloudflare data center</dt><dd data-field="dataCenter">Checking…</dd></div>
  </dl>
  <p class="tool-hint">Prefer a terminal? <code>curl {{< worker-api-base >}}/api/ip</code> returns just your IP as plain text — add <code>?family=v4</code> or <code>?family=v6</code> to check a specific version, or <code>?format=json</code> for both fields together. Testing your *other* IP version (whichever one you're not currently connected over) needs a separate, protocol-only address — noted as a possible future addition rather than faked here.</p>
</section>

<section class="tool-card" aria-labelledby="tool-location-title">
  <h2 id="tool-location-title">Approximate location <span class="tool-caveat">(from your IP address, not GPS)</span></h2>
  <dl class="tool-grid" data-tool-location>
    <div><dt>Country</dt><dd data-field="country">Checking…</dd></div>
    <div><dt>Region</dt><dd data-field="region">Checking…</dd></div>
    <div><dt>City</dt><dd data-field="city">Checking…</dd></div>
    <div><dt>IP-reported timezone</dt><dd data-field="ipTimezone">Checking…</dd></div>
    <div><dt>Browser-reported timezone</dt><dd data-field="browserTimezone">Checking…</dd></div>
  </dl>
  <p class="tool-hint" data-tool-timezone-note hidden></p>
</section>

<section class="tool-card" aria-labelledby="tool-device-title">
  <h2 id="tool-device-title">Your browser and device</h2>
  <dl class="tool-grid" data-tool-device>
    <div><dt>Browser reports itself as</dt><dd data-field="userAgent">Checking…</dd></div>
    <div><dt>Platform</dt><dd data-field="platform">Checking…</dd></div>
    <div><dt>Language(s)</dt><dd data-field="languages">Checking…</dd></div>
    <div><dt>Screen resolution</dt><dd data-field="screen">Checking…</dd></div>
    <div><dt>Viewport size</dt><dd data-field="viewport">Checking…</dd></div>
    <div><dt>CPU cores reported</dt><dd data-field="cores">Checking…</dd></div>
    <div><dt>Device memory (approx.)</dt><dd data-field="memory">Checking…</dd></div>
    <div><dt>Connection type</dt><dd data-field="connection">Checking…</dd></div>
    <div><dt>Color scheme preference</dt><dd data-field="colorScheme">Checking…</dd></div>
    <div><dt>Reduced motion preference</dt><dd data-field="reducedMotion">Checking…</dd></div>
    <div><dt>Cookies enabled</dt><dd data-field="cookies">Checking…</dd></div>
  </dl>
</section>

<section class="tool-card" aria-labelledby="tool-webrtc-title">
  <h2 id="tool-webrtc-title">WebRTC leak test</h2>
  <p>WebRTC can reveal your real local and public IP addresses to a website even behind a VPN, because it talks to the network directly instead of going through your browser's usual proxy settings. Here's what this page can see:</p>
  <ul class="tool-list" data-tool-webrtc>
    <li data-webrtc-status>Checking…</li>
  </ul>
</section>

<section class="tool-card" aria-labelledby="tool-fingerprint-title">
  <h2 id="tool-fingerprint-title">Canvas &amp; WebGL fingerprint</h2>
  <p>Sites can generate a semi-unique identifier for your device by rendering a hidden image and measuring subtle differences caused by your specific GPU, drivers, and fonts — no cookies required. This is what that technique sees for your current browser:</p>
  <dl class="tool-grid" data-tool-fingerprint>
    <div><dt>Canvas fingerprint</dt><dd data-field="canvasHash">Computing…</dd></div>
    <div><dt>WebGL renderer</dt><dd data-field="webglRenderer">Computing…</dd></div>
    <div><dt>WebGL vendor</dt><dd data-field="webglVendor">Computing…</dd></div>
  </dl>
</section>
