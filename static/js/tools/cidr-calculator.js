(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const form = page.querySelector("[data-cidr-form]");
  if (!form) return;
  const input = form.elements.cidr;
  const resultCard = page.querySelector("[data-cidr-result]");
  const errorNode = page.querySelector("[data-cidr-error]");
  const lang = document.documentElement.lang === "ru" ? "ru" : "en";

  const text = {
    en: {
      invalid: "Enter an address like 192.168.1.0/24 (prefix defaults to /32 if omitted).",
      hostsSingle: "1 address (no subnetting — a single host route)",
      hostsPair: "2 addresses, both usable (RFC 3021 point-to-point link)",
      hostsNone: "0 usable host addresses (network and broadcast only)",
      public: "Public",
      private: "Private (RFC 1918)",
    },
    ru: {
      invalid: "Введите адрес вида 192.168.1.0/24 (если префикс не указан, используется /32).",
      hostsSingle: "1 адрес (без разбиения на подсети — маршрут на один узел)",
      hostsPair: "2 адреса, оба используемые (RFC 3021, точка-точка)",
      hostsNone: "0 используемых адресов узлов (только сеть и широковещательный)",
      public: "Публичный",
      private: "Приватный (RFC 1918)",
    },
  }[lang];

  // [network, prefix, label-en, label-ru] — ordered most-specific first so
  // the first containing match found is the most precise classification.
  const SPECIAL_RANGES = [
    ["0.0.0.0", 8, "\"This\" network (RFC 791)", "Сеть «this» (RFC 791)"],
    ["10.0.0.0", 8, "Private — RFC 1918", "Приватный — RFC 1918"],
    ["100.64.0.0", 10, "Carrier-grade NAT — RFC 6598", "CGNAT — RFC 6598"],
    ["127.0.0.0", 8, "Loopback", "Loopback (петлевой)"],
    ["169.254.0.0", 16, "Link-local (APIPA)", "Локальный канал (APIPA)"],
    ["172.16.0.0", 12, "Private — RFC 1918", "Приватный — RFC 1918"],
    ["192.0.0.0", 24, "IETF protocol assignments", "Протокольные назначения IETF"],
    ["192.0.2.0", 24, "Documentation (TEST-NET-1)", "Документация (TEST-NET-1)"],
    ["192.88.99.0", 24, "6to4 relay anycast (deprecated)", "6to4 relay anycast (устарело)"],
    ["192.168.0.0", 16, "Private — RFC 1918", "Приватный — RFC 1918"],
    ["198.18.0.0", 15, "Benchmark testing", "Тестирование производительности"],
    ["198.51.100.0", 24, "Documentation (TEST-NET-2)", "Документация (TEST-NET-2)"],
    ["203.0.113.0", 24, "Documentation (TEST-NET-3)", "Документация (TEST-NET-3)"],
    ["224.0.0.0", 4, "Multicast", "Мультикаст"],
    ["240.0.0.0", 4, "Reserved for future use", "Зарезервировано"],
    ["255.255.255.255", 32, "Limited broadcast", "Ограниченный широковещательный"],
  ];

  function ipToInt(ip) {
    const parts = ip.trim().split(".");
    if (parts.length !== 4) return null;
    let result = 0;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return null;
      const n = Number(part);
      if (n < 0 || n > 255) return null;
      result = result * 256 + n;
    }
    return result >>> 0;
  }

  function intToIp(int) {
    return [24, 16, 8, 0].map((shift) => (int >>> shift) & 255).join(".");
  }

  function maskFromPrefix(prefix) {
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }

  function parseCidr(raw) {
    const trimmed = raw.trim();
    const match = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\/(\d{1,2}))?$/.exec(trimmed);
    if (!match) return null;
    const ip = ipToInt(match[1]);
    if (ip === null) return null;
    const prefix = match[2] !== undefined ? Number(match[2]) : 32;
    if (prefix < 0 || prefix > 32) return null;
    return { ip, prefix };
  }

  function classify(ip) {
    for (const [base, prefix, labelEn, labelRu] of SPECIAL_RANGES) {
      const baseInt = ipToInt(base);
      const mask = maskFromPrefix(prefix);
      if ((ip & mask) >>> 0 === (baseInt & mask) >>> 0) {
        return lang === "ru" ? labelRu : labelEn;
      }
    }
    return text.public;
  }

  function setField(name, value) {
    const el = resultCard.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value;
  }

  function compute(raw) {
    const parsed = parseCidr(raw);
    if (!parsed) {
      errorNode.textContent = text.invalid;
      errorNode.hidden = false;
      resultCard.hidden = true;
      return;
    }
    errorNode.hidden = true;
    resultCard.hidden = false;

    const { ip, prefix } = parsed;
    const mask = maskFromPrefix(prefix);
    const network = (ip & mask) >>> 0;
    const wildcard = (~mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const totalAddresses = 2 ** (32 - prefix);

    setField("network", `${intToIp(network)}/${prefix}`);
    setField("broadcast", intToIp(broadcast));
    setField("mask", intToIp(mask));
    setField("wildcard", intToIp(wildcard));
    setField("total", totalAddresses.toLocaleString(lang));
    setField("classification", classify(network));

    if (prefix >= 31) {
      const hostsField = resultCard.querySelector('[data-field="hosts"]');
      const rangeField = resultCard.querySelector('[data-field="range"]');
      if (prefix === 32) {
        if (hostsField) hostsField.textContent = text.hostsSingle;
        if (rangeField) rangeField.textContent = intToIp(network);
      } else {
        if (hostsField) hostsField.textContent = text.hostsPair;
        if (rangeField) rangeField.textContent = `${intToIp(network)} – ${intToIp(broadcast)}`;
      }
    } else {
      const firstHost = network + 1;
      const lastHost = broadcast - 1;
      setField("hosts", (totalAddresses - 2).toLocaleString(lang));
      setField("range", `${intToIp(firstHost)} – ${intToIp(lastHost)}`);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    compute(input.value);
  });
  input.addEventListener("input", () => {
    if (input.value.trim()) compute(input.value);
  });

  if (input.value.trim()) compute(input.value);
})();
