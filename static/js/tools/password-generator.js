(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const output = page.querySelector("[data-pwgen-output]");
  const form = page.querySelector("[data-pwgen-form]");
  if (!output || !form) return;

  const lengthInput = form.querySelector("[data-pwgen-length]");
  const lengthValue = page.querySelector("[data-pwgen-length-value]");
  const excludeAmbiguous = form.querySelector("[data-pwgen-exclude-ambiguous]");
  const optionInputs = [...form.querySelectorAll("[data-pwgen-option]")];
  const entropyNode = page.querySelector("[data-pwgen-entropy]");
  const errorNode = page.querySelector("[data-pwgen-error]");
  const copyButton = page.querySelector("[data-pwgen-copy]");
  const regenerateButton = page.querySelector("[data-pwgen-regenerate]");

  const lang = document.documentElement.lang === "ru" ? "ru" : "en";
  const text = {
    en: {
      noCharsets: "Select at least one character type.",
      copy: "Copy",
      copied: "Copied!",
      bits: (n) => `${n} bits of entropy`,
      strength: { weak: "Weak", ok: "Reasonable", strong: "Strong", veryStrong: "Very strong" },
    },
    ru: {
      noCharsets: "Выберите хотя бы один тип символов.",
      copy: "Скопировать",
      copied: "Скопировано!",
      bits: (n) => `${n} бит энтропии`,
      strength: { weak: "Слабый", ok: "Приемлемый", strong: "Надёжный", veryStrong: "Очень надёжный" },
    },
  }[lang];

  const CHAR_SETS = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
  };
  const AMBIGUOUS = new Set("0OoIl1|");

  // Uniform random integer in [0, maxExclusive) via rejection sampling, so
  // every value has exactly equal probability. A naive `byte % max` is
  // biased whenever 256 isn't a multiple of max — a common, subtle bug in
  // password generators that quietly makes some characters more likely
  // than others.
  function secureRandomInt(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    const bytesNeeded = Math.max(1, Math.ceil(Math.log2(maxExclusive) / 8));
    const range = 256 ** bytesNeeded;
    const maxValid = Math.floor(range / maxExclusive) * maxExclusive;
    const buffer = new Uint8Array(bytesNeeded);
    let value;
    do {
      crypto.getRandomValues(buffer);
      value = buffer.reduce((acc, byte, i) => acc + byte * 256 ** i, 0);
    } while (value >= maxValid);
    return value % maxExclusive;
  }

  function stripAmbiguous(chars) {
    return [...chars].filter((c) => !AMBIGUOUS.has(c)).join("");
  }

  function buildCharsets(options) {
    const categories = [];
    let combined = "";
    for (const key of ["lower", "upper", "digits", "symbols"]) {
      if (!options[key]) continue;
      const set = options.excludeAmbiguous ? stripAmbiguous(CHAR_SETS[key]) : CHAR_SETS[key];
      if (!set) continue;
      categories.push(set);
      combined += set;
    }
    return { combined, categories };
  }

  function generate(length, options) {
    const { combined, categories } = buildCharsets(options);
    if (!combined || categories.length === 0) return null;

    const chars = [];
    for (const set of categories) {
      if (chars.length >= length) break;
      chars.push(set[secureRandomInt(set.length)]);
    }
    while (chars.length < length) {
      chars.push(combined[secureRandomInt(combined.length)]);
    }

    // Fisher–Yates shuffle with the same CSPRNG, so the guaranteed
    // one-per-category characters aren't predictably placed at the start.
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = secureRandomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return { password: chars.slice(0, length).join(""), charsetSize: combined.length };
  }

  function strengthLabel(bits) {
    if (bits < 40) return text.strength.weak;
    if (bits < 60) return text.strength.ok;
    if (bits < 80) return text.strength.strong;
    return text.strength.veryStrong;
  }

  function currentOptions() {
    const options = { excludeAmbiguous: excludeAmbiguous.checked };
    optionInputs.forEach((input) => { options[input.dataset.pwgenOption] = input.checked; });
    return options;
  }

  function render() {
    const length = Number(lengthInput.value);
    if (lengthValue) lengthValue.textContent = String(length);

    const result = generate(length, currentOptions());
    if (!result) {
      output.textContent = "";
      if (errorNode) { errorNode.textContent = text.noCharsets; errorNode.hidden = false; }
      if (entropyNode) entropyNode.textContent = "";
      return;
    }
    if (errorNode) errorNode.hidden = true;
    output.textContent = result.password;

    const bits = Math.round(length * Math.log2(result.charsetSize));
    if (entropyNode) entropyNode.textContent = `${text.bits(bits)} — ${strengthLabel(bits)}`;
  }

  form.addEventListener("input", render);
  regenerateButton?.addEventListener("click", render);
  copyButton?.addEventListener("click", async () => {
    if (!output.textContent) return;
    try {
      await navigator.clipboard.writeText(output.textContent);
      const original = copyButton.textContent;
      copyButton.textContent = text.copied;
      window.setTimeout(() => { copyButton.textContent = original; }, 1500);
    } catch (_) {
      // Clipboard API can be unavailable (permissions, insecure context);
      // the password is still visible and selectable on screen.
    }
  });

  render();
})();
