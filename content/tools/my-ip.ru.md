---
title: "Мой IP"
description: "Ваш текущий публичный IP-адрес — в браузере или из терминала одной командой curl."
searchDescription: "Быстро узнайте свой публичный IPv4 или IPv6 адрес в браузере или через curl."
layout: "my-ip"
toolScript: "js/tools/my-ip.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-myip-title">
  <h2 id="tool-myip-title">Ваш IP-адрес</h2>
  <p class="tool-ip-display" data-myip-value>Проверяю…</p>
  <p class="tool-hint" data-myip-family></p>
</section>

<section class="tool-card" aria-labelledby="tool-myip-curl-title">
  <h2 id="tool-myip-curl-title">Из терминала</h2>
  <p>Браузер не нужен — работает так же с любой машины, где есть <code>curl</code>:</p>
  <pre class="tool-code"><code>curl {{< worker-api-base >}}/api/ip</code></pre>
  <p>Только адрес, обычным текстом — больше ничего в ответе, поэтому можно сразу передавать в скрипт. Несколько вариантов:</p>
  <pre class="tool-code"><code>curl "{{< worker-api-base >}}/api/ip?family=v4"   # только если вы реально подключены по IPv4
curl "{{< worker-api-base >}}/api/ip?family=v6"   # только если вы реально подключены по IPv6
curl "{{< worker-api-base >}}/api/ip?format=json" # {"ip":"...","family":"IPv4"}</code></pre>
  <p class="tool-hint">Этот эндпоинт намеренно публичный и не требует заголовка Origin от браузера — специально для того, чтобы работал обычный <code>curl</code>. Он лишь возвращает IP-адрес того, кто спрашивает; ничего не логируется и не сохраняется.</p>
</section>

<p class="tools-note">Нужно больше деталей — провайдер, версия TLS, примерное местоположение, тест утечки через WebRTC, фингерпринт браузера? Смотрите <a href="{{< relref "tools/connection-check.ru.md" >}}">полную проверку соединения и браузера</a>.</p>
