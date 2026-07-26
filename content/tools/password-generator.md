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

<section class="tool-card" aria-labelledby="tool-pwgen-terminal-title">
  <h2 id="tool-pwgen-terminal-title">From a terminal</h2>
  <p>These generate a password the same way this page does — locally, using your machine's own cryptographically secure random number generator — with nothing sent to any server. There's deliberately no <code>curl</code>-based option here, unlike the IP tool: a password generator that has to ask a server for the password isn't one where "nothing is sent anywhere" is actually true anymore.</p>
  <h3>macOS / Linux (bash, zsh)</h3>
  <p>Reads raw bytes from <code>/dev/urandom</code> and keeps only the ones matching the allowed character set — no modulo, so no bias:</p>
  <pre class="tool-code"><code>LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()-_=+' &lt; /dev/urandom | head -c 20; echo</code></pre>
  <p>Change <code>20</code> to any length, and edit the character ranges in the <code>tr</code> set to change what's allowed.</p>
  <h3>Windows PowerShell</h3>
  <p>Uses <code>RandomNumberGenerator</code>, not <code>Get-Random</code> — <code>Get-Random</code> is not cryptographically secure and shouldn't be used for anything security-sensitive. This does its own rejection sampling for the same reason the browser version does:</p>
  <pre class="tool-code"><code>$chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+'
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 1
$limit = 256 - (256 % $chars.Length)
-join (1..20 | ForEach-Object {
  do { $rng.GetBytes($bytes) } while ($bytes[0] -ge $limit)
  $chars[$bytes[0] % $chars.Length]
})</code></pre>
  <p>Works in both Windows PowerShell 5.1 (built into every Windows install) and PowerShell 7+. Paste the whole block at once.</p>
  <h3>Windows cmd.exe</h3>
  <p>cmd.exe has no built-in cryptographic random source at all, and there isn't a clean, reliable way to fake one in a single command. The straightforward path: type <code>powershell</code> to start a PowerShell session from within cmd — it's on every Windows machine — then run the PowerShell block above.</p>
</section>
