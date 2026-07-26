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

<section class="tool-card" aria-labelledby="tool-pwgen-terminal-title">
  <h2 id="tool-pwgen-terminal-title">Из терминала</h2>
  <p>Эти команды генерируют пароль так же, как эта страница — локально, с помощью криптостойкого генератора случайных чисел вашей же машины — ничего не отправляется ни на какой сервер. Здесь намеренно нет варианта через <code>curl</code>, в отличие от инструмента проверки IP: генератор паролей, которому нужно спросить пароль у сервера, — это уже не тот генератор, где «ничего никуда не отправляется» действительно так.</p>
  <h3>macOS / Linux (bash, zsh)</h3>
  <p>Читает случайные байты из <code>/dev/urandom</code> и оставляет только те, что входят в разрешённый набор символов — без деления по модулю, а значит без смещения:</p>
  <pre class="tool-code"><code>LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()-_=+' &lt; /dev/urandom | head -c 20; echo</code></pre>
  <p>Замените <code>20</code> на нужную длину и отредактируйте диапазоны символов в наборе <code>tr</code>, чтобы изменить допустимые символы.</p>
  <h3>Windows PowerShell</h3>
  <p>Используется <code>RandomNumberGenerator</code>, а не <code>Get-Random</code> — <code>Get-Random</code> не является криптостойким и не должен использоваться для чего-либо, связанного с безопасностью. Здесь применяется та же отбраковка (rejection sampling), что и в браузерной версии:</p>
  <pre class="tool-code"><code>$chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+'
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 1
$limit = 256 - (256 % $chars.Length)
-join (1..20 | ForEach-Object {
  do { $rng.GetBytes($bytes) } while ($bytes[0] -ge $limit)
  $chars[$bytes[0] % $chars.Length]
})</code></pre>
  <p>Работает и в Windows PowerShell 5.1 (встроен в любую установку Windows), и в PowerShell 7+. Вставляйте весь блок целиком.</p>
  <h3>Windows cmd.exe</h3>
  <p>У cmd.exe вообще нет встроенного криптографического источника случайности, и надёжно эмулировать его одной командой не получится. Самый простой путь: наберите <code>powershell</code>, чтобы запустить сеанс PowerShell прямо из cmd — он есть на любой машине с Windows — а затем выполните блок PowerShell выше.</p>
</section>
