(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const apiBase = (page.dataset.apiBase || "").replace(/\/$/, "");
  const valueNode = page.querySelector("[data-myip-value]");
  const familyNode = page.querySelector("[data-myip-family]");
  if (!valueNode) return;

  const lang = document.documentElement.lang === "ru" ? "ru" : "en";
  const text = {
    en: { error: "Could not reach the network check right now.", family: (f) => `Connected over ${f}` },
    ru: { error: "Не удалось получить данные сети прямо сейчас.", family: (f) => `Подключение по ${f}` },
  }[lang];

  if (!apiBase) {
    valueNode.textContent = text.error;
    return;
  }

  fetch(`${apiBase}/api/ip?format=json`, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`status ${response.status}`);
      return response.json();
    })
    .then((data) => {
      valueNode.textContent = data.ip || text.error;
      if (familyNode && data.family) familyNode.textContent = text.family(data.family);
    })
    .catch(() => {
      valueNode.textContent = text.error;
    });
})();
