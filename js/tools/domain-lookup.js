(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const apiBase = (page.dataset.apiBase || "").replace(/\/$/, "");
  const form = page.querySelector("[data-domain-form]");
  if (!form) return;
  const input = form.elements.domain;
  const errorNode = page.querySelector("[data-domain-error]");
  const loadingNode = page.querySelector("[data-domain-loading]");
  const registrationCard = page.querySelector("[data-domain-registration]");
  const registrationUnavailable = page.querySelector("[data-domain-registration-unavailable]");
  const dnsCard = page.querySelector("[data-domain-dns]");
  const lang = document.documentElement.lang === "ru" ? "ru" : "en";

  const text = {
    en: {
      invalid: "Enter a domain name like example.com.",
      networkError: "Could not reach the lookup service. Please try again.",
      loading: "Looking up…",
      none: "None found",
      noRegistration: "Registration data isn't available for this domain's TLD, or the lookup failed.",
    },
    ru: {
      invalid: "Введите доменное имя, например example.com.",
      networkError: "Не удалось обратиться к сервису поиска. Попробуйте ещё раз.",
      loading: "Ищу…",
      none: "Не найдено",
      noRegistration: "Данные о регистрации недоступны для этого домена, либо запрос не удался.",
    },
  }[lang];

  function setField(root, name, value) {
    const el = root.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value;
  }

  function joinList(values) {
    return values && values.length ? values.join(", ") : text.none;
  }

  function formatDate(iso) {
    if (!iso) return text.none;
    try {
      return new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
      });
    } catch {
      return iso;
    }
  }

  async function lookup(domain) {
    errorNode.hidden = true;
    registrationCard.hidden = true;
    dnsCard.hidden = true;
    loadingNode.hidden = false;

    try {
      const response = await fetch(`${apiBase}/api/domain-lookup?domain=${encodeURIComponent(domain)}`, {
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        errorNode.textContent = data && data.error ? data.error : text.networkError;
        errorNode.hidden = false;
        return;
      }

      dnsCard.hidden = false;
      setField(dnsCard, "A", joinList(data.dns.A));
      setField(dnsCard, "AAAA", joinList(data.dns.AAAA));
      setField(dnsCard, "MX", joinList(data.dns.MX));
      setField(dnsCard, "NS", joinList(data.dns.NS));
      setField(dnsCard, "TXT", joinList(data.dns.TXT));
      setField(dnsCard, "CAA", joinList(data.dns.CAA));

      registrationCard.hidden = false;
      if (data.registration) {
        registrationUnavailable.hidden = true;
        setField(registrationCard, "registrar", data.registration.registrar || text.none);
        setField(registrationCard, "registered", formatDate(data.registration.registered));
        setField(registrationCard, "expires", formatDate(data.registration.expires));
        setField(registrationCard, "lastChanged", formatDate(data.registration.lastChanged));
        setField(registrationCard, "status", joinList(data.registration.status));
        setField(registrationCard, "nameservers", joinList(data.registration.nameservers));
      } else {
        registrationUnavailable.hidden = false;
        ["registrar", "registered", "expires", "lastChanged", "status", "nameservers"].forEach((name) =>
          setField(registrationCard, name, text.none));
      }
    } catch {
      errorNode.textContent = text.networkError;
      errorNode.hidden = false;
    } finally {
      loadingNode.hidden = true;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const domain = input.value.trim().toLowerCase();
    if (!domain) return;
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain.replace(/\.$/, ""))) {
      errorNode.textContent = text.invalid;
      errorNode.hidden = false;
      registrationCard.hidden = true;
      dnsCard.hidden = true;
      return;
    }
    lookup(domain);
  });
})();
