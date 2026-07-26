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
  <p>Браузер не нужен. В ответе всегда только сам IP-адрес — больше ничего, поэтому можно сразу передавать в скрипт.</p>
  <p class="tool-hint">Команды ниже обращаются к <code>{{< worker-api-base >}}</code>, а не к f12.biz — это не опечатка. Это API — отдельный сервис на Cloudflare Worker со своим доменом, а не часть самого сайта f12.biz; f12.biz обслуживается напрямую GitHub Pages, который вообще не умеет выполнять серверный код вроде этого.</p>
  <h3>macOS / Linux (bash, zsh) и Windows cmd.exe</h3>
  <p>Windows 10 и новее поставляются с настоящим <code>curl.exe</code>, поэтому эта же команда без изменений работает и в cmd.exe:</p>
  <pre class="tool-code"><code>curl {{< worker-api-base >}}/api/ip</code></pre>
  <h3>Windows PowerShell</h3>
  <p>В PowerShell <code>curl</code> — это псевдоним для <code>Invoke-WebRequest</code>, который возвращает объект ответа, а не обычный текст. Либо вызывайте <code>curl.exe</code> напрямую, либо используйте собственный командлет PowerShell:</p>
  <pre class="tool-code"><code>curl.exe {{< worker-api-base >}}/api/ip
# или, средствами PowerShell:
(Invoke-RestMethod "{{< worker-api-base >}}/api/ip?format=json").ip</code></pre>
  <h3>Несколько вариантов — синтаксис одинаков везде</h3>
  <pre class="tool-code"><code>curl "{{< worker-api-base >}}/api/ip?family=v4"   # только если вы реально подключены по IPv4
curl "{{< worker-api-base >}}/api/ip?family=v6"   # только если вы реально подключены по IPv6
curl "{{< worker-api-base >}}/api/ip?format=json" # {"ip":"...","family":"IPv4"}</code></pre>
  <p class="tool-hint">Этот эндпоинт намеренно публичный и не требует заголовка Origin от браузера — специально для того, чтобы работал обычный <code>curl</code>, из любого варианта выше. Он лишь возвращает IP-адрес того, кто спрашивает; ничего не логируется и не сохраняется.</p>
</section>

<p class="tools-note">Нужно больше деталей — провайдер, версия TLS, примерное местоположение, тест утечки через WebRTC, фингерпринт браузера? Смотрите <a href="{{< relref "tools/connection-check.ru.md" >}}">полную проверку соединения и браузера</a>.</p>
