---
title: "Password Generator"
description: "Generate a cryptographically random password entirely in your browser — nothing is sent anywhere, ever."
searchDescription: "Secure password generator using the Web Crypto API with rejection sampling and configurable character sets."
layout: "password-generator"
toolScript: "js/tools/password-generator.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-pwgen-title">
  <h2 id="tool-pwgen-title">Generate a password</h2>
  <p class="tool-pw-display" data-pwgen-output aria-live="polite"></p>
  <p class="tool-error" data-pwgen-error hidden></p>
  <div class="tool-pw-actions">
    <button type="button" class="tool-btn tool-btn--primary" data-pwgen-copy>Copy</button>
    <button type="button" class="tool-btn" data-pwgen-regenerate>Generate new</button>
  </div>
  <p class="tool-hint" data-pwgen-entropy></p>

  <form class="tool-pwgen-form" data-pwgen-form>
    <div class="tool-pwgen-length">
      <label for="pwgen-length">Length: <output for="pwgen-length" data-pwgen-length-value>20</output></label>
      <input id="pwgen-length" type="range" min="8" max="128" value="20" data-pwgen-length>
    </div>
    <fieldset class="tool-pwgen-fieldset">
      <legend>Character types</legend>
      <label><input type="checkbox" data-pwgen-option="lower" checked> Lowercase (a–z)</label>
      <label><input type="checkbox" data-pwgen-option="upper" checked> Uppercase (A–Z)</label>
      <label><input type="checkbox" data-pwgen-option="digits" checked> Digits (0–9)</label>
      <label><input type="checkbox" data-pwgen-option="symbols" checked> Symbols (!@#$…)</label>
    </fieldset>
    <label class="tool-pwgen-ambiguous"><input type="checkbox" data-pwgen-exclude-ambiguous> Exclude ambiguous characters (0, O, 1, l, I, |)</label>
  </form>
</section>

<section class="tool-card" aria-labelledby="tool-pwgen-how-title">
  <h2 id="tool-pwgen-how-title">How this actually works</h2>
  <ul class="tool-list">
    <li>Uses the Web Crypto API's <code>crypto.getRandomValues()</code> — a cryptographically secure random number generator, not <code>Math.random()</code>, which was never designed to be unpredictable.</li>
    <li>Character selection uses rejection sampling to avoid modulo bias, a subtle mistake in many password generators that quietly makes some characters more likely to appear than others.</li>
    <li>If you select more than one character type, one of each is guaranteed to appear — then the whole password, including where those guaranteed characters end up, is shuffled using the same secure randomness.</li>
    <li>Nothing is sent anywhere. The password is generated and stays entirely in this browser tab — close or reload the page and it's gone for good.</li>
  </ul>
</section>
