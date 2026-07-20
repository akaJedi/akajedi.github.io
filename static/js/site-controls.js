(() => {
  "use strict";

  const STORAGE_KEY = "theme";

  const isDark = () => document.documentElement.getAttribute("data-bs-theme") === "dark";

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(isDark()));
    button.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-bs-theme", next);
      document.documentElement.removeAttribute("data-theme-auto");
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
      button.setAttribute("aria-pressed", String(next === "dark"));
    });
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    let stored = "";
    try { stored = localStorage.getItem(STORAGE_KEY) || ""; } catch (_) {}
    if (stored) return;
    document.documentElement.setAttribute("data-bs-theme", event.matches ? "dark" : "light");
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(event.matches));
    });
  });
})();
