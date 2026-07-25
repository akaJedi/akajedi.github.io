---
title: "Проверка соединения и браузера"
description: "Узнайте, что именно ваше соединение и браузер сообщают этому сайту — IP, примерное местоположение, сеть, TLS и живой тест на утечки через WebRTC/фингерпринтинг."
searchDescription: "Проверьте свой IP, провайдера, версию TLS и то, могут ли WebRTC или canvas-фингерпринтинг раскрыть информацию о вас."
layout: "connection-check"
toolScript: "js/tools/connection-check.js"
searchExclude: true
---

<p class="tools-note">Всё на этой странице либо вычисляется прямо в вашем браузере, либо считывается из информации, которую сеть Cloudflare и так видит при каждом запросе. Ничего здесь не сохраняется, не логируется и никуда не отправляется, кроме этого единственного запроса — вы видите только свои собственные данные, показанные вам же.</p>

<section class="tool-card" aria-labelledby="tool-network-title">
  <h2 id="tool-network-title">Ваша сеть</h2>
  <dl class="tool-grid" data-tool-network>
    <div><dt>IP-адрес</dt><dd data-field="ip">Проверяю…</dd></div>
    <div><dt>Версия протокола</dt><dd data-field="protocolFamily">Проверяю…</dd></div>
    <div><dt>Провайдер (ASN)</dt><dd data-field="organization">Проверяю…</dd></div>
    <div><dt>HTTP-протокол</dt><dd data-field="httpProtocol">Проверяю…</dd></div>
    <div><dt>Версия TLS</dt><dd data-field="tlsVersion">Проверяю…</dd></div>
    <div><dt>Дата-центр Cloudflare</dt><dd data-field="dataCenter">Проверяю…</dd></div>
  </dl>
  <p class="tool-hint">Предпочитаете терминал? <code>curl {{< worker-api-base >}}/api/ip</code> вернёт только ваш IP в виде обычного текста — добавьте <code>?family=v4</code> или <code>?family=v6</code>, чтобы проверить конкретную версию, либо <code>?format=json</code>, чтобы получить оба поля вместе. Проверка второй версии протокола (той, что сейчас не используется) требует отдельного адреса, доступного только по этому протоколу — отмечено как возможное будущее дополнение, а не имитируется здесь.</p>
</section>

<section class="tool-card" aria-labelledby="tool-location-title">
  <h2 id="tool-location-title">Примерное местоположение <span class="tool-caveat">(по IP-адресу, не по GPS)</span></h2>
  <dl class="tool-grid" data-tool-location>
    <div><dt>Страна</dt><dd data-field="country">Проверяю…</dd></div>
    <div><dt>Регион</dt><dd data-field="region">Проверяю…</dd></div>
    <div><dt>Город</dt><dd data-field="city">Проверяю…</dd></div>
    <div><dt>Часовой пояс по IP</dt><dd data-field="ipTimezone">Проверяю…</dd></div>
    <div><dt>Часовой пояс браузера</dt><dd data-field="browserTimezone">Проверяю…</dd></div>
  </dl>
  <p class="tool-hint" data-tool-timezone-note hidden></p>
</section>

<section class="tool-card" aria-labelledby="tool-device-title">
  <h2 id="tool-device-title">Ваш браузер и устройство</h2>
  <dl class="tool-grid" data-tool-device>
    <div><dt>Браузер представляется как</dt><dd data-field="userAgent">Проверяю…</dd></div>
    <div><dt>Платформа</dt><dd data-field="platform">Проверяю…</dd></div>
    <div><dt>Язык(и)</dt><dd data-field="languages">Проверяю…</dd></div>
    <div><dt>Разрешение экрана</dt><dd data-field="screen">Проверяю…</dd></div>
    <div><dt>Размер окна просмотра</dt><dd data-field="viewport">Проверяю…</dd></div>
    <div><dt>Ядер процессора</dt><dd data-field="cores">Проверяю…</dd></div>
    <div><dt>Память устройства (приблизительно)</dt><dd data-field="memory">Проверяю…</dd></div>
    <div><dt>Тип соединения</dt><dd data-field="connection">Проверяю…</dd></div>
    <div><dt>Предпочтение цветовой схемы</dt><dd data-field="colorScheme">Проверяю…</dd></div>
    <div><dt>Предпочтение уменьшенного движения</dt><dd data-field="reducedMotion">Проверяю…</dd></div>
    <div><dt>Куки включены</dt><dd data-field="cookies">Проверяю…</dd></div>
  </dl>
</section>

<section class="tool-card" aria-labelledby="tool-webrtc-title">
  <h2 id="tool-webrtc-title">Тест утечки через WebRTC</h2>
  <p>WebRTC может раскрыть ваш настоящий локальный и публичный IP-адрес сайту, даже если вы используете VPN, потому что он обращается к сети напрямую, а не через обычные настройки прокси браузера. Вот что видит эта страница:</p>
  <ul class="tool-list" data-tool-webrtc>
    <li data-webrtc-status>Проверяю…</li>
  </ul>
</section>

<section class="tool-card" aria-labelledby="tool-fingerprint-title">
  <h2 id="tool-fingerprint-title">Фингерпринт Canvas и WebGL</h2>
  <p>Сайты могут создать полууникальный идентификатор вашего устройства, отрисовав скрытое изображение и измерив мелкие отличия, вызванные вашим конкретным GPU, драйверами и шрифтами — без использования куки. Вот что показывает этот метод для вашего текущего браузера:</p>
  <dl class="tool-grid" data-tool-fingerprint>
    <div><dt>Фингерпринт Canvas</dt><dd data-field="canvasHash">Вычисляю…</dd></div>
    <div><dt>Рендерер WebGL</dt><dd data-field="webglRenderer">Вычисляю…</dd></div>
    <div><dt>Производитель WebGL</dt><dd data-field="webglVendor">Вычисляю…</dd></div>
  </dl>
</section>
