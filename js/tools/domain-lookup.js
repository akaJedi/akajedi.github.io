(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const apiBase = (page.dataset.apiBase || "").replace(/\/$/, "");
  const form = page.querySelector("[data-domain-form]");
  if (!form) return;

  const input = form.elements.domain;
  const submit = form.querySelector('button[type="submit"]');
  const errorNode = page.querySelector("[data-domain-error]");
  const loadingNode = page.querySelector("[data-domain-loading]");
  const healthSection = page.querySelector("[data-domain-health]");
  const findingsSection = page.querySelector("[data-domain-findings]");
  const findingsList = page.querySelector("[data-domain-findings-list]");
  const rawDetails = page.querySelector("[data-domain-raw]");
  const registrationCard = page.querySelector("[data-domain-registration]");
  const registrationUnavailable = page.querySelector("[data-domain-registration-unavailable]");
  const dnsCard = page.querySelector("[data-domain-dns]");
  const consensusSection = page.querySelector("[data-resolver-consensus]");
  const consensusBody = page.querySelector("[data-consensus-body]");
  const lang = document.documentElement.lang === "ru" ? "ru" : "en";

  const standardUrls = {
    "RFC 2182": "https://www.rfc-editor.org/rfc/rfc2182.html",
    "RFC 4035": "https://www.rfc-editor.org/rfc/rfc4035.html",
    "RFC 5321": "https://www.rfc-editor.org/rfc/rfc5321.html",
    "RFC 7208": "https://www.rfc-editor.org/rfc/rfc7208.html",
    "RFC 7505": "https://www.rfc-editor.org/rfc/rfc7505.html",
    "RFC 8461": "https://www.rfc-editor.org/rfc/rfc8461.html",
    "RFC 8659": "https://www.rfc-editor.org/rfc/rfc8659.html",
    "RFC 9083": "https://www.rfc-editor.org/rfc/rfc9083.html",
    "RFC 9989": "https://www.rfc-editor.org/rfc/rfc9989.html",
  };

  const copy = {
    en: {
      invalid: "Enter a domain name like example.com.",
      networkError: "Could not reach the inspection service. Please try again.",
      incomplete: "The inspection service returned an incomplete result. Please try again after the Worker update is deployed.",
      none: "None found",
      noRegistration: "Registration data is unavailable for this TLD, or the RDAP lookup failed.",
      registrationLookup: {
        ok: "Authoritative RDAP response received",
        unsupported: "No RDAP service is published for this TLD",
        not_found: "Domain not found by the authoritative RDAP service",
        temporary_error: "RDAP service temporarily unavailable",
        invalid_response: "RDAP service returned an unusable response",
      },
      consensusVerdict: {
        consistent: "Both public resolvers returned the same record sets and validation state.",
        inconsistent: "Resolver disagreement detected. This can indicate propagation, stale caches, split answers, or DNSSEC trouble.",
        partial: "One resolver could not complete every query. Compare again before treating an empty result as authoritative.",
      },
      consensusState: {
        match: "Match",
        different: "Different",
        dnssec_disagreement: "DNSSEC differs",
        unavailable: "Unavailable",
      },
      resolverError: { http: "HTTP error", network: "Network error", timeout: "Timed out" },
      emptyAnswer: "No answers",
      verdict: {
        critical: "Action required — at least one standards-level failure can affect availability, mail delivery, or trust.",
        warning: "Operational review recommended — no critical failure was found, but one or more controls are weak or ambiguous.",
        pass: "Core controls look healthy. Advisory items below are optional hardening opportunities.",
      },
      status: { critical: "Critical", warning: "Warning", pass: "Pass", info: "Advisory" },
      evidence: "Observed evidence",
      remediation: "Operator action",
      checks: {
        "nameserver-redundancy": ["Nameserver redundancy", "A delegated zone needs at least two distinct authoritative nameservers so one failure does not remove the domain from DNS.", "Publish at least two independent authoritative NS records; three is recommended for most organizational zones."],
        "dnssec-valid": ["DNSSEC validation", "A DS record is published and the validating resolver authenticated the DNS data.", ""],
        "dnssec-unvalidated": ["DNSSEC validation failure", "A DS record exists, but the resolver could not authenticate the response. A broken chain can make the domain unreachable to validating clients.", "Compare the registrar DS values with the active DNS provider keys before changing anything else."],
        "dnssec-unsigned": ["DNSSEC not enabled", "No signed delegation was found. This is optional hardening, not a DNS failure.", "Enable DNSSEC at the authoritative provider, then publish the matching DS record at the registrar."],
        "mx-null-mixed": ["Conflicting null MX", "A null MX declaration must be the only MX record. Mixing it with real exchangers creates contradictory mail-routing policy.", "Remove the null MX or the real MX records according to whether the domain accepts mail."],
        "mx-null": ["Mail explicitly disabled", "The single null MX correctly declares that this domain accepts no email.", ""],
        "mx-present": ["Mail routing", "The domain publishes explicit mail exchangers.", ""],
        "mx-implicit": ["Mail routing is ambiguous", "Without MX, senders may fall back to the apex A/AAAA address instead of failing cleanly.", "Publish real MX records if the domain accepts mail; otherwise publish the single null MX record ‘0 .’."],
        "spf-multiple": ["Multiple SPF policies", "SPF permits one policy record. Multiple v=spf1 records produce a permanent SPF error.", "Merge the mechanisms into one SPF record and delete the duplicates."],
        "spf-permissive": ["SPF authorizes every sender", "+all allows any source to send as the domain and defeats SPF anti-spoofing.", "Replace +all with an intentionally scoped policy, normally ending in ~all or -all after validation."],
        "spf-present": ["SPF policy", "Exactly one SPF policy was found.", ""],
        "spf-missing": ["SPF policy missing", "No SPF sender authorization policy was found.", "Publish one v=spf1 policy for legitimate senders, or v=spf1 -all when the domain sends no mail."],
        "dmarc-multiple": ["Multiple DMARC policies", "DMARC discovery fails when more than one valid policy record is returned.", "Consolidate the policy into one TXT record at _dmarc."],
        "dmarc-missing": ["DMARC policy missing", "The domain does not publish instructions for mail that fails aligned SPF and DKIM checks.", "Start with a monitored DMARC policy and reporting address, then progress to quarantine or reject after reviewing reports."],
        "dmarc-invalid": ["Invalid DMARC policy", "The DMARC record is missing a valid p=none, p=quarantine, or p=reject policy.", "Correct the tag order and policy syntax in the single _dmarc TXT record."],
        "dmarc-monitoring": ["DMARC is monitoring only", "p=none collects authentication results but does not request quarantine or rejection of failing mail.", "Review aggregate reports, align legitimate senders, then progress to p=quarantine or p=reject."],
        "dmarc-enforcing": ["DMARC enforcement", "The domain requests quarantine or rejection for mail that fails DMARC.", ""],
        "caa-present": ["Certificate authority policy", "CAA limits which certificate authorities may issue certificates for the domain.", ""],
        "caa-missing": ["CAA not restricted", "No CAA policy is published, so any publicly trusted CA may issue after successful validation.", "Optionally publish issue and issuewild CAA records for the certificate authorities you actually use."],
        "registration-expiry-unknown": ["Registration expiry unavailable", "RDAP did not provide an expiration date for this registry.", "Verify renewal and registrar-lock status directly with the registrar."],
        "registration-expired": ["Registration appears expired", "The RDAP expiration date is in the past.", "Confirm status with the registrar immediately and restore registration if possible."],
        "registration-expiring-critical": ["Registration expires within 30 days", "The renewal window is now operationally urgent.", "Confirm auto-renewal, payment method, registrar lock, and recovery contacts now."],
        "registration-expiring": ["Registration expires within 90 days", "The domain is approaching its renewal window.", "Confirm auto-renewal, payment method, and registrar contacts."],
        "registration-current": ["Registration lifecycle", "The reported expiration date is more than 90 days away.", ""],
        "mta-sts-present": ["MTA-STS signal", "The DNS discovery record for SMTP transport policy is present.", ""],
        "mta-sts-missing": ["MTA-STS not advertised", "No SMTP transport-security discovery record was found. This is optional defense in depth.", "If the domain receives mail, consider publishing MTA-STS and TLS reporting after validating every MX endpoint."],
      },
    },
    ru: {
      invalid: "Введите доменное имя, например example.com.",
      networkError: "Не удалось обратиться к сервису проверки. Попробуйте ещё раз.",
      incomplete: "Сервис вернул неполный результат. Повторите проверку после обновления Worker.",
      none: "Не найдено",
      noRegistration: "Данные регистрации недоступны для этого домена или запрос RDAP завершился ошибкой.",
      registrationLookup: {
        ok: "Получен ответ авторитетного сервиса RDAP",
        unsupported: "Для этой доменной зоны сервис RDAP не опубликован",
        not_found: "Авторитетный сервис RDAP не нашёл домен",
        temporary_error: "Сервис RDAP временно недоступен",
        invalid_response: "Сервис RDAP вернул непригодный ответ",
      },
      consensusVerdict: {
        consistent: "Оба публичных резолвера вернули одинаковые записи и состояние проверки.",
        inconsistent: "Обнаружено расхождение. Возможные причины: распространение изменений, устаревший кэш, разные ответы или DNSSEC.",
        partial: "Один резолвер не завершил все запросы. Повторите сравнение, прежде чем считать пустой ответ достоверным.",
      },
      consensusState: {
        match: "Совпало",
        different: "Различается",
        dnssec_disagreement: "Различается DNSSEC",
        unavailable: "Недоступно",
      },
      resolverError: { http: "Ошибка HTTP", network: "Ошибка сети", timeout: "Тайм-аут" },
      emptyAnswer: "Нет ответов",
      verdict: {
        critical: "Требуется действие — обнаружена ошибка стандарта, способная повлиять на доступность, доставку почты или доверие.",
        warning: "Рекомендуется проверка — критических ошибок нет, но некоторые настройки ослаблены или неоднозначны.",
        pass: "Основные настройки исправны. Рекомендации ниже относятся к дополнительному усилению защиты.",
      },
      status: { critical: "Критично", warning: "Предупреждение", pass: "Пройдено", info: "Рекомендация" },
      evidence: "Обнаруженные данные",
      remediation: "Действие оператора",
      checks: {
        "nameserver-redundancy": ["Резервирование серверов имён", "Для делегированной зоны нужны как минимум два разных авторитетных DNS-сервера.", "Опубликуйте как минимум две независимые NS-записи; для большинства организаций рекомендуется три сервера."],
        "dnssec-valid": ["Проверка DNSSEC", "DS-запись опубликована, а проверяющий резолвер подтвердил подлинность DNS-данных.", ""],
        "dnssec-unvalidated": ["Ошибка проверки DNSSEC", "DS-запись существует, но резолвер не смог проверить ответ. Нарушенная цепочка может сделать домен недоступным.", "Сравните DS у регистратора с активными ключами DNS-провайдера."],
        "dnssec-unsigned": ["DNSSEC не включён", "Подписанное делегирование не найдено. Это дополнительная защита, а не поломка DNS.", "Включите DNSSEC у DNS-провайдера, затем опубликуйте соответствующую DS-запись у регистратора."],
        "mx-null-mixed": ["Противоречивая null MX", "Null MX должна быть единственной MX-записью. Совмещение с реальными серверами создаёт противоречивую политику.", "Удалите null MX или реальные MX в зависимости от того, принимает ли домен почту."],
        "mx-null": ["Почта явно отключена", "Единственная null MX корректно сообщает, что домен не принимает почту.", ""],
        "mx-present": ["Маршрутизация почты", "Домен публикует явные почтовые серверы.", ""],
        "mx-implicit": ["Неоднозначная маршрутизация почты", "Без MX отправители могут пытаться доставить почту на A/AAAA адрес домена.", "Опубликуйте реальные MX либо единственную null MX ‘0 .’."],
        "spf-multiple": ["Несколько политик SPF", "SPF допускает одну запись политики. Несколько v=spf1 приводят к постоянной ошибке SPF.", "Объедините механизмы в одну SPF-запись и удалите дубликаты."],
        "spf-permissive": ["SPF разрешает любого отправителя", "+all позволяет любому источнику отправлять почту от имени домена.", "Замените +all на ограниченную проверенную политику, обычно с ~all или -all в конце."],
        "spf-present": ["Политика SPF", "Найдена ровно одна политика SPF.", ""],
        "spf-missing": ["Политика SPF отсутствует", "Политика авторизации отправителей SPF не найдена.", "Опубликуйте одну v=spf1 для разрешённых отправителей либо v=spf1 -all, если домен не отправляет почту."],
        "dmarc-multiple": ["Несколько политик DMARC", "Обнаружение DMARC завершается ошибкой, если возвращается более одной политики.", "Объедините политику в одну TXT-запись на _dmarc."],
        "dmarc-missing": ["Политика DMARC отсутствует", "Домен не публикует инструкции для писем, не прошедших согласованные проверки SPF и DKIM.", "Начните с политики мониторинга и адреса отчётов, затем перейдите к quarantine или reject."],
        "dmarc-invalid": ["Некорректная политика DMARC", "В записи нет допустимого p=none, p=quarantine или p=reject.", "Исправьте порядок тегов и синтаксис единственной TXT-записи _dmarc."],
        "dmarc-monitoring": ["DMARC только наблюдает", "p=none собирает результаты, но не запрашивает изоляцию или отклонение поддельной почты.", "Проверьте отчёты и затем перейдите к p=quarantine или p=reject."],
        "dmarc-enforcing": ["Применение DMARC", "Домен запрашивает изоляцию или отклонение писем, не прошедших DMARC.", ""],
        "caa-present": ["Политика центров сертификации", "CAA ограничивает центры сертификации, которым разрешена выдача сертификатов.", ""],
        "caa-missing": ["CAA не ограничена", "Политика CAA отсутствует; любой доверенный центр может выдать сертификат после проверки.", "При необходимости опубликуйте issue и issuewild для реально используемых центров сертификации."],
        "registration-expiry-unknown": ["Срок регистрации неизвестен", "RDAP не вернул дату истечения регистрации.", "Проверьте продление и блокировку домена непосредственно у регистратора."],
        "registration-expired": ["Регистрация выглядит истёкшей", "Дата истечения RDAP находится в прошлом.", "Немедленно проверьте статус у регистратора и восстановите регистрацию, если возможно."],
        "registration-expiring-critical": ["До истечения регистрации меньше 30 дней", "Продление стало срочной операционной задачей.", "Проверьте автопродление, оплату, блокировку и контакты восстановления."],
        "registration-expiring": ["До истечения регистрации меньше 90 дней", "Домен приближается к периоду продления.", "Проверьте автопродление, способ оплаты и контакты регистратора."],
        "registration-current": ["Жизненный цикл регистрации", "До указанной даты истечения остаётся более 90 дней.", ""],
        "mta-sts-present": ["Сигнал MTA-STS", "DNS-запись обнаружения политики защиты SMTP присутствует.", ""],
        "mta-sts-missing": ["MTA-STS не объявлен", "Запись обнаружения защиты транспорта SMTP не найдена. Это дополнительная защита.", "Если домен принимает почту, рассмотрите MTA-STS и TLS-отчёты после проверки всех MX."],
      },
    },
  }[lang];

  const statusOrder = { critical: 0, warning: 1, info: 2, pass: 3 };

  function setField(root, name, value) {
    const el = root.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value;
  }

  function joinList(values) {
    return values && values.length ? values.join(", ") : copy.none;
  }

  function formatDate(iso) {
    if (!iso) return copy.none;
    try {
      return new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
      });
    } catch {
      return iso;
    }
  }

  function resetResults() {
    errorNode.hidden = true;
    healthSection.hidden = true;
    findingsSection.hidden = true;
    consensusSection.hidden = true;
    consensusBody.replaceChildren();
    rawDetails.hidden = true;
    registrationCard.hidden = true;
    dnsCard.hidden = true;
    findingsList.replaceChildren();
  }

  function appendText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
  }

  function renderChecks(domain, checks) {
    const counts = { critical: 0, warning: 0, pass: 0, info: 0 };
    checks.forEach((check) => {
      if (Object.hasOwn(counts, check.status)) counts[check.status] += 1;
    });
    Object.entries(counts).forEach(([status, count]) => {
      const node = healthSection.querySelector(`[data-count="${status}"]`);
      if (node) node.textContent = String(count);
    });

    const overall = counts.critical ? "critical" : counts.warning ? "warning" : "pass";
    healthSection.dataset.state = overall;
    healthSection.querySelector("[data-domain-result-name]").textContent = domain;
    healthSection.querySelector("[data-domain-verdict]").textContent = copy.verdict[overall];

    const sorted = checks.slice().sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    sorted.forEach((check, index) => {
      const definition = copy.checks[check.id] || [check.id, "", ""];
      const article = document.createElement("article");
      article.className = `domain-finding domain-finding--${check.status}`;
      article.style.setProperty("--finding-order", String(index));

      const header = document.createElement("header");
      appendText(header, "span", "domain-finding__status", copy.status[check.status] || check.status);
      appendText(header, "h3", "", definition[0]);
      article.appendChild(header);
      appendText(article, "p", "domain-finding__message", definition[1]);

      if (check.evidence && check.evidence.length) {
        const evidence = document.createElement("details");
        evidence.className = "domain-finding__evidence";
        appendText(evidence, "summary", "", copy.evidence);
        const list = document.createElement("ul");
        check.evidence.forEach((item) => appendText(list, "li", "", String(item)));
        evidence.appendChild(list);
        article.appendChild(evidence);
      }

      if (definition[2] && check.status !== "pass") {
        const action = document.createElement("p");
        action.className = "domain-finding__action";
        appendText(action, "strong", "", `${copy.remediation}: `);
        action.append(document.createTextNode(definition[2]));
        article.appendChild(action);
      }

      const standard = document.createElement("a");
      standard.className = "domain-finding__standard";
      standard.href = standardUrls[check.standard] || "https://www.rfc-editor.org/";
      standard.target = "_blank";
      standard.rel = "noopener noreferrer";
      standard.textContent = check.standard;
      standard.setAttribute("aria-label", `${check.standard} (${lang === "ru" ? "откроется в новой вкладке" : "opens in a new tab"})`);
      article.appendChild(standard);
      findingsList.appendChild(article);
    });

    healthSection.hidden = false;
    findingsSection.hidden = false;
    healthSection.focus();
  }

  const rcodeNames = { 0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 4: "NOTIMP", 5: "REFUSED" };

  function renderResolverObservation(cell, observation) {
    const result = observation || {};
    let value;
    if (result.error) value = copy.resolverError[result.error] || result.error;
    else if (result.status !== 0) value = rcodeNames[result.status] || `RCODE ${result.status}`;
    else value = result.answers && result.answers.length ? result.answers.join(" · ") : copy.emptyAnswer;
    appendText(cell, "code", "resolver-consensus__answer", value);

    const meta = document.createElement("span");
    meta.className = "resolver-consensus__meta";
    const ttl = Number.isFinite(result.ttl) ? `TTL ${result.ttl}s` : "TTL —";
    const dnssec = result.authenticated ? "AD ✓" : "AD —";
    const timing = Number.isFinite(result.durationMs) ? `${result.durationMs} ms` : "— ms";
    meta.textContent = `${ttl} · ${dnssec} · ${timing}`;
    cell.appendChild(meta);
  }

  function renderConsensus(consensus) {
    if (!consensus || !Array.isArray(consensus.records)) {
      consensusSection.hidden = true;
      return;
    }
    consensusSection.dataset.state = consensus.verdict || "partial";
    const verdictNode = consensusSection.querySelector("[data-consensus-verdict]");
    verdictNode.textContent = copy.consensusVerdict[consensus.verdict] || copy.consensusVerdict.partial;
    Object.entries(consensus.summary || {}).forEach(([name, value]) => {
      const node = consensusSection.querySelector(`[data-consensus-count="${name}"]`);
      if (node) node.textContent = String(value);
    });

    consensus.records.forEach((record) => {
      const row = document.createElement("tr");
      row.className = `resolver-consensus__row resolver-consensus__row--${record.state}`;
      const recordCell = document.createElement("th");
      recordCell.scope = "row";
      appendText(recordCell, "span", "resolver-consensus__record", record.key);
      appendText(recordCell, "small", "resolver-consensus__query", `${record.name} · ${record.type}`);
      row.appendChild(recordCell);

      const cloudflareCell = document.createElement("td");
      renderResolverObservation(cloudflareCell, record.cloudflare);
      row.appendChild(cloudflareCell);
      const googleCell = document.createElement("td");
      renderResolverObservation(googleCell, record.google);
      row.appendChild(googleCell);

      const stateCell = document.createElement("td");
      appendText(stateCell, "span", "resolver-consensus__state", copy.consensusState[record.state] || record.state);
      row.appendChild(stateCell);
      consensusBody.appendChild(row);
    });
    consensusSection.hidden = false;
  }

  function renderRaw(data) {
    const dns = data.dns || {};
    dnsCard.hidden = false;
    ["A", "AAAA", "CNAME", "MX", "NS", "DS", "TXT", "DMARC", "MTA_STS", "CAA"].forEach((name) =>
      setField(dnsCard, name, joinList(dns[name])));

    registrationCard.hidden = false;
    const registrationLookup = data.registrationLookup || {};
    const registrationLookupText = copy.registrationLookup[registrationLookup.status] || copy.noRegistration;
    setField(registrationCard, "rdapLookup", registrationLookupText);
    setField(registrationCard, "rdapSource", registrationLookup.source || copy.none);
    if (data.registration) {
      registrationUnavailable.hidden = true;
      setField(registrationCard, "registrar", data.registration.registrar || copy.none);
      setField(registrationCard, "registered", formatDate(data.registration.registered));
      setField(registrationCard, "expires", formatDate(data.registration.expires));
      setField(registrationCard, "lastChanged", formatDate(data.registration.lastChanged));
      setField(registrationCard, "status", joinList(data.registration.status));
      setField(registrationCard, "nameservers", joinList(data.registration.nameservers));
    } else {
      registrationUnavailable.textContent = registrationLookupText;
      registrationUnavailable.hidden = false;
      ["registrar", "registered", "expires", "lastChanged", "status", "nameservers"].forEach((name) =>
        setField(registrationCard, name, copy.none));
    }
    rawDetails.hidden = false;
  }

  async function lookup(domain) {
    resetResults();
    loadingNode.hidden = false;
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(`${apiBase}/api/domain-lookup?domain=${encodeURIComponent(domain)}`, {
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        errorNode.textContent = data && data.error ? data.error : copy.networkError;
        errorNode.hidden = false;
        return;
      }
      if (!Array.isArray(data.checks) || data.checks.length === 0) {
        errorNode.textContent = copy.incomplete;
        errorNode.hidden = false;
        return;
      }
      renderChecks(data.domain, data.checks);
      renderConsensus(data.consensus);
      renderRaw(data);
      const current = new URL(window.location.href);
      current.searchParams.set("domain", data.domain);
      history.replaceState(null, "", current);
    } catch {
      errorNode.textContent = copy.networkError;
      errorNode.hidden = false;
    } finally {
      loadingNode.hidden = true;
      submit.disabled = false;
      form.removeAttribute("aria-busy");
    }
  }

  function normalizeDomain(value) {
    const candidate = value.trim().toLowerCase().replace(/[.\u3002\uFF0E\uFF61]$/, "");
    if (!candidate || /[\s\/:?#@%\\]/.test(candidate)) return null;
    try {
      const domain = new URL(`http://${candidate}`).hostname;
      return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9](?:[a-z0-9-]{0,57}[a-z0-9])?)$/.test(domain)
        ? domain
        : null;
    } catch {
      return null;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const domain = normalizeDomain(input.value);
    if (!domain) {
      resetResults();
      errorNode.textContent = copy.invalid;
      errorNode.hidden = false;
      input.focus();
      return;
    }
    lookup(domain);
  });

  const initialDomain = normalizeDomain(new URL(window.location.href).searchParams.get("domain") || "");
  if (initialDomain) {
    input.value = initialDomain;
    lookup(initialDomain);
  }
})();
