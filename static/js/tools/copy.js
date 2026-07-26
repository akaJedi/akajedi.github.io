(() => {
  const page = document.querySelector("[data-tools-page]");
  if (!page) return;

  const isRu = document.documentElement.lang === "ru";
  const copyLabel = isRu ? "Копировать" : "Copy";
  const copiedLabel = isRu ? "Скопировано" : "Copied";

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function flashCopied(el) {
    window.clearTimeout(el._copyTimer);
    el.classList.add("tool-copied");
    el._copyTimer = window.setTimeout(() => el.classList.remove("tool-copied"), 1200);
  }

  // Values: click a result field, an IP display, or a reference-table cell
  // to copy its exact text — no separate button needed for these.
  const valueTargets = page.querySelectorAll(
    ".tool-grid dd[data-field], .tool-ip-display, .tool-table td",
  );
  valueTargets.forEach((el) => {
    el.classList.add("tool-copyable");
    el.setAttribute("data-copied-label", copiedLabel);
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", isRu ? "Скопировать значение" : "Copy value");
    const trigger = async () => {
      const text = el.textContent.trim();
      if (await copyText(text)) flashCopied(el);
    };
    el.addEventListener("click", trigger);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trigger();
      }
    });
  });

  // Code blocks: a dedicated Copy button, since these are multi-line and a
  // click-anywhere-to-copy would fight with normal text selection.
  page.querySelectorAll("pre.tool-code").forEach((pre) => {
    if (pre.parentElement?.classList.contains("tool-code-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "tool-code-wrap";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-code-copy";
    button.textContent = copyLabel;
    wrap.appendChild(button);

    button.addEventListener("click", async () => {
      const ok = await copyText(pre.textContent.trim());
      if (!ok) return;
      button.textContent = copiedLabel;
      window.setTimeout(() => { button.textContent = copyLabel; }, 1500);
    });
  });
})();
