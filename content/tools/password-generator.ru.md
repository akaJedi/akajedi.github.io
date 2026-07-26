---
title: "Генератор паролей"
description: "Сгенерируйте криптографически случайный пароль полностью в вашем браузере — ничего никуда не отправляется."
searchDescription: "Надёжный генератор паролей на основе Web Crypto API с отбраковкой смещения и настраиваемыми наборами символов."
layout: "password-generator"
toolScript: "js/tools/password-generator.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-pwgen-title">
  <h2 id="tool-pwgen-title">Сгенерировать пароль</h2>
  <p class="tool-pw-display" data-pwgen-output aria-live="polite"></p>
  <p class="tool-error" data-pwgen-error hidden></p>
  <div class="tool-pw-actions">
    <button type="button" class="tool-btn tool-btn--primary" data-pwgen-copy>Скопировать</button>
    <button type="button" class="tool-btn" data-pwgen-regenerate>Сгенерировать новый</button>
  </div>
  <p class="tool-hint" data-pwgen-entropy></p>

  <form class="tool-pwgen-form" data-pwgen-form>
    <div class="tool-pwgen-length">
      <label for="pwgen-length">Длина: <output for="pwgen-length" data-pwgen-length-value>20</output></label>
      <input id="pwgen-length" type="range" min="8" max="128" value="20" data-pwgen-length>
    </div>
    <fieldset class="tool-pwgen-fieldset">
      <legend>Типы символов</legend>
      <label><input type="checkbox" data-pwgen-option="lower" checked> Строчные (a–z)</label>
      <label><input type="checkbox" data-pwgen-option="upper" checked> Прописные (A–Z)</label>
      <label><input type="checkbox" data-pwgen-option="digits" checked> Цифры (0–9)</label>
      <label><input type="checkbox" data-pwgen-option="symbols" checked> Символы (!@#$…)</label>
    </fieldset>
    <label class="tool-pwgen-ambiguous"><input type="checkbox" data-pwgen-exclude-ambiguous> Исключить похожие символы (0, O, 1, l, I, |)</label>
  </form>
</section>

<section class="tool-card" aria-labelledby="tool-pwgen-how-title">
  <h2 id="tool-pwgen-how-title">Как это на самом деле работает</h2>
  <ul class="tool-list">
    <li>Используется <code>crypto.getRandomValues()</code> из Web Crypto API — криптографически стойкий генератор случайных чисел, а не <code>Math.random()</code>, который никогда не задумывался как непредсказуемый.</li>
    <li>Выбор символов использует отбраковку (rejection sampling), чтобы избежать смещения по модулю — тонкая ошибка во многих генераторах паролей, из-за которой одни символы незаметно оказываются более вероятными, чем другие.</li>
    <li>Если выбрано больше одного типа символов, гарантированно появится хотя бы по одному из каждого — а затем весь пароль, включая позиции этих гарантированных символов, перемешивается той же криптостойкой случайностью.</li>
    <li>Ничего никуда не отправляется. Пароль генерируется и остаётся исключительно в этой вкладке браузера — закройте или обновите страницу, и он исчезнет безвозвратно.</li>
  </ul>
</section>
