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
  <p>No browser needed. The response is always just the plain IP address — nothing else — so it's safe to pipe straight into a script.</p>
  <p class="tool-hint">The commands below point at <code>{{< worker-api-base >}}</code>, not f12.biz — that's not a typo. This API is a separate Cloudflare Worker service behind its own domain, not part of the f12.biz website itself; f12.biz is served directly by GitHub Pages, which can't run backend code like this at all.</p>
  <h3>macOS / Linux (bash, zsh) and Windows cmd.exe</h3>
  <p>Windows 10 and later ship a real <code>curl.exe</code>, so this exact command works unchanged in cmd.exe too:</p>
  <pre class="tool-code"><code>curl {{< worker-api-base >}}/api/ip</code></pre>
  <h3>Windows PowerShell</h3>
  <p>PowerShell aliases <code>curl</code> to <code>Invoke-WebRequest</code>, which returns a response object rather than plain text. Either call <code>curl.exe</code> directly, or use PowerShell's own idiomatic cmdlet:</p>
  <pre class="tool-code"><code>curl.exe {{< worker-api-base >}}/api/ip
# or, PowerShell-native:
(Invoke-RestMethod "{{< worker-api-base >}}/api/ip?format=json").ip</code></pre>
  <h3>A couple of options, same syntax on every platform</h3>
  <pre class="tool-code"><code>curl "{{< worker-api-base >}}/api/ip?family=v4"   # only if you're actually connected over IPv4
curl "{{< worker-api-base >}}/api/ip?family=v6"   # only if you're actually connected over IPv6
curl "{{< worker-api-base >}}/api/ip?format=json" # {"ip":"...","family":"IPv4"}</code></pre>
  <p class="tool-hint">This endpoint is intentionally public and doesn't require a browser Origin header — that's specifically so plain <code>curl</code> works, from any of the above. It only ever echoes back the IP address of whoever's asking; nothing is logged or stored.</p>
</section>

<p class="tools-note">Want more detail — ISP, TLS version, approximate location, a WebRTC leak test, browser fingerprint? See the <a href="{{< relref "tools/connection-check" >}}">full Connection &amp; Browser Check</a>.</p>
