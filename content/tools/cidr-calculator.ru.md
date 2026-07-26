---
title: "Калькулятор CIDR"
description: "Вычислите адрес сети, широковещательный адрес, маску и диапазон используемых адресов узлов подсети — плюс справочные таблицы приватных, зарезервированных и специальных диапазонов IP."
searchDescription: "Калькулятор CIDR / подсетей с определением публичных и приватных диапазонов IP и справочными таблицами."
layout: "cidr-calculator"
toolScript: "js/tools/cidr-calculator.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-calc-title">
  <h2 id="tool-calc-title">Калькулятор</h2>
  <form class="tool-form" data-cidr-form>
    <label for="cidr-input">IP-адрес / префикс</label>
    <div class="tool-form__row">
      <input id="cidr-input" name="cidr" type="text" value="192.168.1.0/24" autocomplete="off" spellcheck="false" placeholder="192.168.1.0/24">
      <button type="submit">Вычислить</button>
    </div>
  </form>
  <p class="tool-error" data-cidr-error hidden></p>
  <dl class="tool-grid" data-cidr-result>
    <div><dt>Адрес сети</dt><dd data-field="network"></dd></div>
    <div><dt>Широковещательный адрес</dt><dd data-field="broadcast"></dd></div>
    <div><dt>Маска подсети</dt><dd data-field="mask"></dd></div>
    <div><dt>Инверсная маска (wildcard)</dt><dd data-field="wildcard"></dd></div>
    <div><dt>Диапазон используемых адресов</dt><dd data-field="range"></dd></div>
    <div><dt>Используемых адресов узлов</dt><dd data-field="hosts"></dd></div>
    <div><dt>Всего адресов</dt><dd data-field="total"></dd></div>
    <div><dt>Классификация</dt><dd data-field="classification"></dd></div>
  </dl>
</section>

<section class="tool-card" aria-labelledby="tool-prefix-title">
  <h2 id="tool-prefix-title">Частые длины префикса</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Префикс</th><th>Маска подсети</th><th>Всего адресов</th><th>Используемых узлов</th></tr></thead>
      <tbody>
        <tr><td>/30</td><td>255.255.255.252</td><td>4</td><td>2</td></tr>
        <tr><td>/29</td><td>255.255.255.248</td><td>8</td><td>6</td></tr>
        <tr><td>/28</td><td>255.255.255.240</td><td>16</td><td>14</td></tr>
        <tr><td>/27</td><td>255.255.255.224</td><td>32</td><td>30</td></tr>
        <tr><td>/26</td><td>255.255.255.192</td><td>64</td><td>62</td></tr>
        <tr><td>/25</td><td>255.255.255.128</td><td>128</td><td>126</td></tr>
        <tr><td>/24</td><td>255.255.255.0</td><td>256</td><td>254</td></tr>
        <tr><td>/23</td><td>255.255.254.0</td><td>512</td><td>510</td></tr>
        <tr><td>/22</td><td>255.255.252.0</td><td>1 024</td><td>1 022</td></tr>
        <tr><td>/21</td><td>255.255.248.0</td><td>2 048</td><td>2 046</td></tr>
        <tr><td>/20</td><td>255.255.240.0</td><td>4 096</td><td>4 094</td></tr>
        <tr><td>/16</td><td>255.255.0.0</td><td>65 536</td><td>65 534</td></tr>
        <tr><td>/8</td><td>255.0.0.0</td><td>16 777 216</td><td>16 777 214</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="tool-card" aria-labelledby="tool-v4-ranges-title">
  <h2 id="tool-v4-ranges-title">Приватные и зарезервированные диапазоны IPv4</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Диапазон</th><th>Назначение</th></tr></thead>
      <tbody>
        <tr><td>10.0.0.0/8</td><td>Приватный — RFC 1918</td></tr>
        <tr><td>172.16.0.0/12</td><td>Приватный — RFC 1918</td></tr>
        <tr><td>192.168.0.0/16</td><td>Приватный — RFC 1918</td></tr>
        <tr><td>100.64.0.0/10</td><td>CGNAT — RFC 6598</td></tr>
        <tr><td>127.0.0.0/8</td><td>Loopback (петлевой)</td></tr>
        <tr><td>169.254.0.0/16</td><td>Локальный канал (APIPA)</td></tr>
        <tr><td>192.0.0.0/24</td><td>Протокольные назначения IETF</td></tr>
        <tr><td>192.0.2.0/24</td><td>Документация (TEST-NET-1)</td></tr>
        <tr><td>198.51.100.0/24</td><td>Документация (TEST-NET-2)</td></tr>
        <tr><td>203.0.113.0/24</td><td>Документация (TEST-NET-3)</td></tr>
        <tr><td>198.18.0.0/15</td><td>Тестирование производительности</td></tr>
        <tr><td>224.0.0.0/4</td><td>Мультикаст</td></tr>
        <tr><td>240.0.0.0/4</td><td>Зарезервировано</td></tr>
        <tr><td>255.255.255.255/32</td><td>Ограниченный широковещательный</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="tool-card" aria-labelledby="tool-v6-ranges-title">
  <h2 id="tool-v6-ranges-title">Специальные диапазоны IPv6</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Диапазон</th><th>Назначение</th></tr></thead>
      <tbody>
        <tr><td>::/128</td><td>Неопределённый адрес</td></tr>
        <tr><td>::1/128</td><td>Loopback (петлевой)</td></tr>
        <tr><td>fc00::/7</td><td>Уникальный локальный — приватный, RFC 4193</td></tr>
        <tr><td>fe80::/10</td><td>Локальный канал</td></tr>
        <tr><td>::ffff:0:0/96</td><td>IPv4-адрес в формате IPv6</td></tr>
        <tr><td>64:ff9b::/96</td><td>NAT64</td></tr>
        <tr><td>2001:db8::/32</td><td>Документация</td></tr>
        <tr><td>2002::/16</td><td>6to4 (устарело)</td></tr>
        <tr><td>ff00::/8</td><td>Мультикаст</td></tr>
        <tr><td>2000::/3</td><td>Глобальный юникаст — публичный</td></tr>
      </tbody>
    </table>
  </div>
</section>
