---
title: "Инспектор состояния домена"
description: "Аудит DNS и регистрации со сравнением ответов Cloudflare и Google для выявления расхождений распространения и DNSSEC."
searchDescription: "Проверка состояния DNS и сравнение резолверов: NS, DNSSEC, MX, SPF, DMARC, CAA, MTA-STS и срок регистрации."
layout: "domain-lookup"
toolScript: "js/tools/domain-lookup.js"
searchExclude: true
---

<section class="tool-card domain-inspector" aria-labelledby="tool-lookup-title">
  <div class="domain-inspector__heading">
    <div>
      <p class="domain-inspector__eyebrow">DNS / ПОЧТА / ДЕЛЕГИРОВАНИЕ</p>
      <h2 id="tool-lookup-title">Проверить домен</h2>
    </div>
    <span class="domain-inspector__mode">Только чтение · открытые данные</span>
  </div>
  <form class="tool-form" data-domain-form>
    <label for="domain-input">Доменное имя</label>
    <div class="tool-form__row">
      <input id="domain-input" name="domain" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="example.com" required>
      <button type="submit">Запустить проверку</button>
    </div>
  </form>
  <p class="tool-error" data-domain-error role="alert" hidden></p>
  <p class="tool-hint" data-domain-loading role="status" hidden>Проверяю DNS и данные RDAP…</p>
</section>

<section class="domain-health" data-domain-health hidden tabindex="-1" aria-labelledby="domain-health-title" aria-live="polite">
  <header class="domain-health__header">
    <div>
      <p class="domain-inspector__eyebrow">Результат проверки</p>
      <h2 id="domain-health-title"><span data-domain-result-name></span></h2>
      <p data-domain-verdict></p>
    </div>
    <div class="domain-health__signal" data-domain-signal aria-hidden="true"><span></span></div>
  </header>
  <dl class="domain-health__counts">
    <div data-count-status="critical"><dt>Критические</dt><dd data-count="critical">0</dd></div>
    <div data-count-status="warning"><dt>Предупреждения</dt><dd data-count="warning">0</dd></div>
    <div data-count-status="pass"><dt>Пройдено</dt><dd data-count="pass">0</dd></div>
    <div data-count-status="info"><dt>Рекомендации</dt><dd data-count="info">0</dd></div>
  </dl>
</section>

<section class="resolver-consensus" data-resolver-consensus hidden aria-labelledby="resolver-consensus-title">
  <header class="resolver-consensus__header">
    <div>
      <p class="domain-inspector__eyebrow">Сверка резолверов</p>
      <h2 id="resolver-consensus-title">Cloudflare ↔ Google</h2>
      <p data-consensus-verdict></p>
    </div>
    <span class="resolver-consensus__privacy">ECS 0.0.0.0/0 · режим приватности</span>
  </header>
  <dl class="resolver-consensus__counts">
    <div><dt>Совпало</dt><dd data-consensus-count="match">0</dd></div>
    <div><dt>Различается</dt><dd data-consensus-count="different">0</dd></div>
    <div><dt>DNSSEC</dt><dd data-consensus-count="dnssecDisagreement">0</dd></div>
    <div><dt>Недоступно</dt><dd data-consensus-count="unavailable">0</dd></div>
  </dl>
  <div class="resolver-consensus__viewport" tabindex="0" role="region" aria-label="Таблица сравнения DNS-резолверов">
    <table class="resolver-consensus__table">
      <thead><tr><th scope="col">Запись</th><th scope="col">Cloudflare</th><th scope="col">Google</th><th scope="col">Состояние</th></tr></thead>
      <tbody data-consensus-body></tbody>
    </table>
  </div>
</section>

<section class="domain-watch" data-domain-watch hidden aria-labelledby="domain-watch-title">
  <header class="domain-watch__header">
    <div>
      <p class="domain-inspector__eyebrow">Наблюдение за распространением</p>
      <h2 id="domain-watch-title">Следить за одной записью 24 часа</h2>
      <p>Сохранить исходное состояние сейчас, затем сравнивать Cloudflare и Google каждые пять минут. Общая ссылка на временную шкалу действует семь дней после завершения наблюдения.</p>
    </div>
    <span class="domain-watch__cadence">05 МИН / 24 Ч</span>
  </header>
  <form class="domain-watch__form" data-watch-form>
    <label for="domain-watch-record">Запись для наблюдения</label>
    <div>
      <select id="domain-watch-record" name="recordKey">
        <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>NS</option>
        <option>TXT</option><option>CAA</option><option>DS</option><option value="DMARC">DMARC</option><option value="MTA_STS">MTA-STS</option>
      </select>
      <button type="submit">Начать наблюдение на 24 часа</button>
    </div>
    <p class="domain-watch__message" data-watch-message role="status"></p>
  </form>
  <div class="domain-watch__report" data-watch-report hidden>
    <div class="domain-watch__report-head">
      <div>
        <p class="domain-inspector__eyebrow">Временная шкала инцидента</p>
        <h3 data-watch-name></h3>
      </div>
      <div class="domain-watch__actions">
        <span data-watch-status></span>
        <button type="button" data-watch-share>Копировать ссылку</button>
      </div>
    </div>
    <dl class="domain-watch__metrics">
      <div><dt>Замеры</dt><dd data-watch-field="sampleCount">0</dd></div>
      <div><dt>Изменения</dt><dd data-watch-field="changeCount">0</dd></div>
      <div><dt>Следующий замер</dt><dd data-watch-field="nextSampleAt">—</dd></div>
      <div><dt>Конец наблюдения</dt><dd data-watch-field="expiresAt">—</dd></div>
    </dl>
    <ol class="domain-watch__timeline" data-watch-samples tabindex="0" role="region" aria-label="Замеры распространения DNS"></ol>
  </div>
</section>

<section class="domain-findings" data-domain-findings hidden aria-labelledby="domain-findings-title">
  <div class="domain-findings__heading">
    <h2 id="domain-findings-title">Результаты контроля</h2>
    <p>Сначала ошибки. Для каждого результата показаны наблюдаемые данные, операционные последствия и применимый стандарт.</p>
  </div>
  <div class="domain-findings__list" data-domain-findings-list></div>
</section>

<details class="domain-raw" data-domain-raw hidden>
  <summary>Исходные данные DNS и регистрации</summary>
  <section class="tool-card" data-domain-registration hidden aria-labelledby="tool-registration-title">
    <h2 id="tool-registration-title">Регистрация</h2>
    <dl class="tool-grid">
      <div><dt>Проверка RDAP</dt><dd data-field="rdapLookup"></dd></div>
      <div><dt>Способ обнаружения</dt><dd data-field="rdapSource"></dd></div>
      <div><dt>Регистратор</dt><dd data-field="registrar"></dd></div>
      <div><dt>Зарегистрирован</dt><dd data-field="registered"></dd></div>
      <div><dt>Истекает</dt><dd data-field="expires"></dd></div>
      <div><dt>Последнее изменение</dt><dd data-field="lastChanged"></dd></div>
      <div><dt>Статус</dt><dd data-field="status"></dd></div>
      <div><dt>Серверы имён</dt><dd data-field="nameservers"></dd></div>
    </dl>
    <p class="tool-hint" data-domain-registration-unavailable hidden>Данные регистрации недоступны для этого домена или запрос RDAP завершился ошибкой.</p>
  </section>

  <section class="tool-card" data-domain-dns hidden aria-labelledby="tool-dns-title">
    <h2 id="tool-dns-title">Записи DNS</h2>
    <dl class="tool-grid">
      <div><dt>A (IPv4)</dt><dd data-field="A"></dd></div>
      <div><dt>AAAA (IPv6)</dt><dd data-field="AAAA"></dd></div>
      <div><dt>CNAME</dt><dd data-field="CNAME"></dd></div>
      <div><dt>MX (почта)</dt><dd data-field="MX"></dd></div>
      <div><dt>NS (серверы имён)</dt><dd data-field="NS"></dd></div>
      <div><dt>DS (DNSSEC)</dt><dd data-field="DS"></dd></div>
      <div><dt>SPF / другие TXT</dt><dd data-field="TXT"></dd></div>
      <div><dt>DMARC</dt><dd data-field="DMARC"></dd></div>
      <div><dt>MTA-STS</dt><dd data-field="MTA_STS"></dd></div>
      <div><dt>CAA</dt><dd data-field="CAA"></dd></div>
    </dl>
  </section>
</details>

<p class="tools-note">Инспектор сравнивает ответы Cloudflare и Google DNS-over-HTTPS, запрашивает Google без локализации по подсети клиента и получает регистрационные данные через RDAP. Он не подключается к проверяемому домену и не сканирует порты. Результаты разовой проверки не сохраняются; при явном запуске наблюдения открытые данные DNS хранятся до восьми дней, а затем автоматически удаляются. Статус «Рекомендация» означает необязательное усиление защиты, а не ошибку. Проверки основаны на <a href="https://www.rfc-editor.org/rfc/rfc2182.html">RFC 2182</a>, <a href="https://www.rfc-editor.org/rfc/rfc4035.html">RFC 4035</a>, <a href="https://www.rfc-editor.org/rfc/rfc7208.html">RFC 7208</a>, <a href="https://www.rfc-editor.org/rfc/rfc9989.html">RFC 9989</a> и связанных стандартах.</p>
