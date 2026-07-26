---
title: "My IP"
description: "Your current public IP address — in the browser or from the terminal with a single curl command."
searchDescription: "Quickly check your public IPv4 or IPv6 address, in the browser or via curl."
layout: "my-ip"
toolScript: "js/tools/my-ip.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-myip-title">
  <h2 id="tool-myip-title">Your IP address</h2>
  <p class="tool-ip-display" data-myip-value>Checking…</p>
  <p class="tool-hint" data-myip-family></p>
</section>

<section class="tool-card" aria-labelledby="tool-myip-curl-title">
  <h2 id="tool-myip-curl-title">From a terminal</h2>
  <p>No browser needed — this works the same from any machine with <code>curl</code>:</p>
  <pre class="tool-code"><code>curl {{< worker-api-base >}}/api/ip</code></pre>
  <p>Just the address, as plain text — nothing else in the response, so it's safe to pipe straight into a script. A couple of options:</p>
  <pre class="tool-code"><code>curl "{{< worker-api-base >}}/api/ip?family=v4"   # only if you're actually connected over IPv4
curl "{{< worker-api-base >}}/api/ip?family=v6"   # only if you're actually connected over IPv6
curl "{{< worker-api-base >}}/api/ip?format=json" # {"ip":"...","family":"IPv4"}</code></pre>
  <p class="tool-hint">This endpoint is intentionally public and doesn't require a browser Origin header — that's specifically so plain <code>curl</code> works. It only ever echoes back the IP address of whoever's asking; nothing is logged or stored.</p>
</section>

<p class="tools-note">Want more detail — ISP, TLS version, approximate location, a WebRTC leak test, browser fingerprint? See the <a href="{{< relref "tools/connection-check" >}}">full Connection &amp; Browser Check</a>.</p>
