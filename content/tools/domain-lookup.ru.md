---
title: "Проверка домена"
description: "Проверьте DNS-записи и данные о регистрации домена в одном месте — записи A/AAAA/MX/NS/TXT/CAA, а также регистратор, даты создания и истечения."
searchDescription: "Проверка DNS и регистрации домена: записи A, AAAA, MX, NS, TXT, CAA и данные RDAP о регистрации для любого домена."
layout: "domain-lookup"
toolScript: "js/tools/domain-lookup.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-lookup-title">
  <h2 id="tool-lookup-title">Проверить домен</h2>
  <form class="tool-form" data-domain-form>
    <label for="domain-input">Доменное имя</label>
    <div class="tool-form__row">
      <input id="domain-input" name="domain" type="text" autocomplete="off" spellcheck="false" placeholder="example.com">
      <button type="submit">Проверить</button>
    </div>
  </form>
  <p class="tool-error" data-domain-error hidden></p>
  <p class="tool-hint" data-domain-loading hidden>Ищу…</p>
</section>

<section class="tool-card" data-domain-registration hidden aria-labelledby="tool-registration-title">
  <h2 id="tool-registration-title">Регистрация</h2>
  <dl class="tool-grid">
    <div><dt>Регистратор</dt><dd data-field="registrar"></dd></div>
    <div><dt>Зарегистрирован</dt><dd data-field="registered"></dd></div>
    <div><dt>Истекает</dt><dd data-field="expires"></dd></div>
    <div><dt>Последнее изменение</dt><dd data-field="lastChanged"></dd></div>
    <div><dt>Статус</dt><dd data-field="status"></dd></div>
    <div><dt>Серверы имён</dt><dd data-field="nameservers"></dd></div>
  </dl>
  <p class="tool-hint" data-domain-registration-unavailable hidden>Данные о регистрации недоступны для этого домена, либо запрос не удался. Не у каждого реестра есть публичный сервер RDAP.</p>
</section>

<section class="tool-card" data-domain-dns hidden aria-labelledby="tool-dns-title">
  <h2 id="tool-dns-title">DNS-записи</h2>
  <dl class="tool-grid">
    <div><dt>A (IPv4)</dt><dd data-field="A"></dd></div>
    <div><dt>AAAA (IPv6)</dt><dd data-field="AAAA"></dd></div>
    <div><dt>MX (почта)</dt><dd data-field="MX"></dd></div>
    <div><dt>NS (серверы имён)</dt><dd data-field="NS"></dd></div>
    <div><dt>TXT</dt><dd data-field="TXT"></dd></div>
    <div><dt>CAA</dt><dd data-field="CAA"></dd></div>
  </dl>
</section>

<p class="tools-note">Используется DNS-over-HTTPS (публичный резолвер Cloudflare) для записей и <a href="https://rdap.org">RDAP</a> — современная стандартизированная замена WHOIS — для данных о регистрации. Оба сервиса независимы; проверка домена здесь никогда не приводит к обращению этого сайта к серверам самого проверяемого домена. Данные о вашем запросе нигде не сохраняются.</p>
