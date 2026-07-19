(() => {
  "use strict";

  const STORAGE_KEY = "f12.websiteChat.sessionToken";
  const OPEN_INTERVAL = 3000;
  const MINIMIZED_INTERVAL = 15000;
  const MAX_BACKOFF = 60000;
  const DEV_STATUS_INTERVAL = 15000;

  const copy = {
    en: {
      available: "Available",
      leave: "Leave a message",
      availableLong: "I’m available to receive your message. I’ll reply here as soon as possible.",
      quietLong: "Thanks for contacting me. I’m currently unavailable between 11:00 PM and 6:00 AM Los Angeles time. Please leave your message and contact information, and I’ll respond or call you back as soon as possible.",
      network: "The chat service is temporarily unavailable. Please try again.",
      securityRequired: "Complete the Cloudflare security check before starting the conversation.",
      securityLoading: "Loading the Cloudflare security check…",
      securityUnavailable: "The security check could not load. Please refresh the page and try again.",
      sending: "Sending…",
      callbackSaved: "Your callback request has been saved. If I’m unable to respond now, I’ll use the contact information you provided to follow up.",
      contactSaved: "Your contact information has been saved.",
      closed: "This conversation is closed.",
      timezone: "Detected timezone:",
      followup: "A reply may take some time. You can leave a phone number or email if you’d prefer a follow-up.",
      draftSaving: "Saving draft…",
      draftSaved: "Draft saved. You can continue later on this browser.",
      draftRestored: "Draft restored.",
      draftError: "Draft could not be saved. Keep this page open or copy your text.",
    },
    ru: {
      available: "Доступен",
      leave: "Оставьте сообщение",
      availableLong: "Я могу принять ваше сообщение. Отвечу здесь, как только смогу.",
      quietLong: "Спасибо за обращение. Сейчас я недоступен с 23:00 до 6:00 по времени Лос-Анджелеса. Оставьте сообщение и контактные данные — я отвечу или перезвоню при первой возможности.",
      network: "Чат временно недоступен. Попробуйте ещё раз.",
      securityLoading: "Загружаю проверку безопасности Cloudflare…",
      securityRequired: "Пройдите проверку безопасности Cloudflare перед началом разговора.",
      securityUnavailable: "Не удалось загрузить проверку безопасности. Обновите страницу и попробуйте ещё раз.",
      sending: "Отправка…",
      callbackSaved: "Ваш запрос на обратный звонок сохранён. Если я не смогу ответить сейчас, я свяжусь с вами по указанным контактным данным.",
      contactSaved: "Ваши контактные данные сохранены.",
      closed: "Этот разговор закрыт.",
      timezone: "Определённый часовой пояс:",
      followup: "Ответ может занять некоторое время. При желании оставьте телефон или email для связи.",
      draftSaving: "Сохраняю черновик…",
      draftSaved: "Черновик сохранён. К нему можно вернуться позже в этом браузере.",
      draftRestored: "Черновик восстановлен.",
      draftError: "Не удалось сохранить черновик. Не закрывайте страницу или скопируйте текст.",
    },
  };

  const randomId = () =>
    globalThis.crypto?.randomUUID?.() ||
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");

  function init(widget) {
    const language = widget.dataset.lang === "ru" ? "ru" : "en";
    const text = copy[language];
    const apiBase = widget.dataset.apiBase.replace(/\/$/, "");
    const panel = widget.querySelector("[data-chat-panel]");
    const launcher = widget.querySelector("[data-chat-open]");
    const launcherStatus = widget.querySelector("[data-chat-launch-status]");
    const minimize = widget.querySelector("[data-chat-minimize]");
    const availabilityNode = widget.querySelector("[data-chat-availability]");
    const presenceNode = widget.querySelector("[data-chat-presence]");
    const statusNode = widget.querySelector("[data-chat-status]");
    const startForm = widget.querySelector("[data-chat-start-form]");
    const turnstileContainer = widget.querySelector("[data-chat-turnstile]");
    const turnstileSiteKey = widget.dataset.turnstileSiteKey || "";
    const conversationNode = widget.querySelector("[data-chat-conversation]");
    const messageForm = widget.querySelector("[data-chat-message-form]");
    const messageTextarea = messageForm.elements.message;
    const draftStatusNode = widget.querySelector("[data-chat-draft-status]");
    const conversationActions = widget.querySelector("[data-chat-actions]");
    const closedActions = widget.querySelector("[data-chat-closed-actions]");
    const newConversationButton = widget.querySelector("[data-chat-new]");
    const messagesNode = widget.querySelector("[data-chat-messages]");
    const callbackForm = widget.querySelector("[data-chat-callback-form]");
    const followupForm = widget.querySelector("[data-chat-followup-form]");
    const timezoneNode = widget.querySelector("[data-chat-timezone]");
    const devbar = widget.querySelector("[data-chat-devbar]");
    const railTools = widget.querySelector("[data-chat-rail-tools]");
    const devSummary = devbar?.querySelector("[data-dev-summary]");
    const devHelpPanel = devbar?.querySelector("[data-dev-help-panel]");
    const devHelpTitle = devbar?.querySelector("[data-dev-help-title]");
    const devHelpText = devbar?.querySelector("[data-dev-help-text]");
    const devHelpCurrent = devbar?.querySelector("[data-dev-help-current]");
    const timezone = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { return ""; }
    })();

    let submissionToken = "";
    let turnstileToken = "";
    let turnstileLoadTimer = 0;
    let turnstileLoadAttempts = 0;
    let turnstileIdempotencyKey = "";
    let turnstileWidgetId = null;
    let cursor = 0;
    let pollTimer = 0;
    let devStatusTimer = 0;
    let draftTimer = 0;
    let draftLoadedFor = "";
    let draftRevision = 0;
    let draftSaving = false;
    let backoff = OPEN_INTERVAL;
    let polling = false;
    let followupShown = false;
    let conversationTerminated = false;
    const rendered = new Set();
    let sessionToken = "";
    try { sessionToken = localStorage.getItem(STORAGE_KEY) || ""; } catch (_) {}
    let conversationId = sessionToken.includes(".") ? sessionToken.split(".", 1)[0] : "";

    timezoneNode.textContent = timezone ? `${text.timezone} ${timezone}` : "";

    const setStatus = (message, state = "") => {
      statusNode.textContent = message;
      statusNode.dataset.state = state;
    };
    function ensureTurnstile() {
      if (sessionToken || !turnstileContainer) return true;
      if (!turnstileSiteKey || !globalThis.turnstile?.render) {
        turnstileLoadAttempts += 1;
        setStatus(
          turnstileLoadAttempts > 40 ? text.securityUnavailable : text.securityLoading,
          "security",
        );
        if (turnstileLoadAttempts <= 40) {
          clearTimeout(turnstileLoadTimer);
          turnstileLoadTimer = window.setTimeout(ensureTurnstile, 250);
        }
        return false;
      }
      if (turnstileWidgetId !== null) return true;
      turnstileLoadAttempts = 0;
      turnstileWidgetId = globalThis.turnstile.render(turnstileContainer, {
        sitekey: turnstileSiteKey,
        action: "chat_start",
        theme: "auto",
        size: "flexible",
        language,
        callback(token) {
          turnstileToken = token;
          turnstileIdempotencyKey = randomId();
          if (statusNode.dataset.state === "security") setStatus("");
        },
        "expired-callback"() {
          turnstileToken = "";
          turnstileIdempotencyKey = "";
          setStatus(text.securityRequired, "security");
        },
        "error-callback"() {
          turnstileToken = "";
          turnstileIdempotencyKey = "";
          setStatus(text.securityUnavailable, "security");
        },
      });
      return true;
    }

    function resetTurnstile() {
      clearTimeout(turnstileLoadTimer);
      turnstileLoadAttempts = 0;
      turnstileToken = "";
      turnstileIdempotencyKey = "";
      if (turnstileWidgetId !== null && globalThis.turnstile?.reset) {
        globalThis.turnstile.reset(turnstileWidgetId);
      }
    }

    const authHeaders = () => ({
      Authorization: `Bearer ${sessionToken}`,
      "X-Conversation-ID": conversationId,
    });

    async function request(path, options = {}) {
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.auth ? authHeaders() : {}),
          ...(options.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || text.network);
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    function setDevIndicator(name, state, detail) {
      const indicator = devbar?.querySelector("[data-dev-indicator=\"" + name + "\"]");
      if (!indicator) return;
      indicator.dataset.state = state;
      indicator.title = detail;
      if (indicator.getAttribute("aria-expanded") === "true" && devHelpCurrent) {
        devHelpCurrent.textContent = "Current status: " + detail;
      }
    }

    function closeDevHelp() {
      if (!devbar || !devHelpPanel) return;
      devbar.querySelectorAll("[data-dev-indicator]").forEach((indicator) => {
        indicator.setAttribute("aria-expanded", "false");
      });
      devHelpPanel.hidden = true;
    }

    function toggleDevHelp(indicator) {
      if (!devHelpPanel || !devHelpTitle || !devHelpText || !devHelpCurrent) return;
      const wasOpen = indicator.getAttribute("aria-expanded") === "true";
      closeDevHelp();
      if (wasOpen) return;
      indicator.setAttribute("aria-expanded", "true");
      devHelpTitle.textContent = indicator.dataset.devHelpTitle || "Local status";
      devHelpText.textContent = indicator.dataset.devHelp || "";
      devHelpCurrent.textContent = "Current status: " + indicator.title;
      devHelpPanel.hidden = false;
    }

    function setPollState(state, detail) {
      setDevIndicator("poll", state, detail);
    }

    function scheduleDevStatus(delay = DEV_STATUS_INTERVAL) {
      clearTimeout(devStatusTimer);
      if (!devbar || document.hidden) return;
      devStatusTimer = window.setTimeout(refreshDevStatus, delay);
    }

    async function refreshDevStatus() {
      if (!devbar || document.hidden) return;
      setDevIndicator("api", "checking", "Checking " + apiBase);
      try {
        const result = await request("/api/chat/dev-status");
        setDevIndicator("api", "ok", "Worker online at " + apiBase);
        setDevIndicator(
          "database",
          result.database?.ok ? "ok" : "error",
          result.database?.ok ? "Local D1 is responding" : "Local D1 check failed",
        );

        const telegram = result.telegram || {};
        let telegramState = "ok";
        let telegramDetail = "Webhook " + (telegram.webhookHost || "not registered");
        if (!telegram.configured) {
          telegramState = "error";
          telegramDetail = "Telegram secrets are incomplete";
        } else if (!telegram.webhookSet) {
          telegramState = "error";
          telegramDetail = "Telegram webhook is not registered";
        } else if (telegram.lastError) {
          telegramState = "error";
          telegramDetail = telegram.lastError;
        } else if (telegram.pendingUpdates || telegram.outboxPending) {
          telegramState = "warn";
          telegramDetail = String(telegram.pendingUpdates || 0) + " webhook queued · " + String(telegram.outboxPending || 0) + " notification queued";
        }
        setDevIndicator("telegram", telegramState, telegramDetail);
        if (devSummary) {
          devSummary.textContent = (telegram.webhookHost || "Webhook not set") + " · incoming " + String(telegram.pendingUpdates || 0) + " · outgoing " + String(telegram.outboxPending || 0);
          devSummary.title = telegramDetail;
        }
      } catch (error) {
        setDevIndicator("api", "error", "Worker unavailable at " + apiBase);
        setDevIndicator("database", "error", "Cannot check D1 while Worker is unavailable");
        setDevIndicator("telegram", "error", "Cannot check Telegram while Worker is unavailable");
        if (devSummary) devSummary.textContent = error.message || "Worker unavailable at " + apiBase;
      } finally {
        scheduleDevStatus();
      }
    }

    function syncDevbarLayout() {
      const panelOpen = !panel.hidden;
      const compactViewport = window.matchMedia("(max-width: 991px)").matches;
      const pushPage = panelOpen && window.matchMedia("(min-width: 992px)").matches;
      if (pushPage) {
        const siteHeader = document.querySelector("body > .header");
        const siteHeaderHeight = Math.round(siteHeader?.getBoundingClientRect().height || 0);
        if (siteHeaderHeight > 0) {
          widget.style.setProperty("--chat-shell-header-height", Math.max(68, siteHeaderHeight - 4) + "px");
        }
      }
      widget.classList.toggle("is-open", panelOpen);
      document.documentElement.classList.toggle("site-chat-page-open", pushPage);
      panel.setAttribute("aria-modal", compactViewport && panelOpen ? "true" : "false");
      if (devbar && railTools) {
        if (devbar.parentElement !== railTools) railTools.append(devbar);
        devbar.classList.add("is-docked");
        devbar.hidden = false;
      }
    }

    function applyAvailability(value) {
      if (!value) return;
      launcherStatus.textContent = value.available ? text.available : text.leave;
      launcher.classList.toggle("is-available", value.available);
      presenceNode.textContent = value.available ? text.available : text.leave;
      presenceNode.parentElement.classList.toggle("is-available", value.available);
      availabilityNode.textContent = value.available ? text.availableLong : text.quietLong;
      submissionToken = value.submissionToken || submissionToken;
    }

    async function refreshAvailability() {
      try {
        const result = await request("/api/chat/availability");
        applyAvailability(result);
        if (statusNode.dataset.state === "error" && statusNode.textContent === text.network) {
          setStatus("");
        }
      } catch (_) {
        launcherStatus.textContent = text.leave;
        presenceNode.textContent = text.leave;
        presenceNode.parentElement.classList.remove("is-available");
        availabilityNode.textContent = text.network;
      }
    }

    const setDraftStatus = (message, state = "") => {
      draftStatusNode.textContent = message;
      draftStatusNode.dataset.state = state;
    };

    async function loadDraft() {
      if (!sessionToken || conversationTerminated || draftLoadedFor === conversationId) return;
      const loadingFor = conversationId;
      try {
        const result = await request("/api/chat/draft", { auth: true });
        if (loadingFor !== conversationId) return;
        draftLoadedFor = loadingFor;
        if (result.message && !messageTextarea.value) {
          messageTextarea.value = result.message;
          draftRevision += 1;
          setDraftStatus(text.draftRestored, "saved");
        }
      } catch (error) {
        if (error.status !== 401) setDraftStatus(text.draftError, "error");
      }
    }

    async function saveDraft() {
      clearTimeout(draftTimer);
      if (!sessionToken || conversationTerminated) return;
      if (draftSaving) {
        draftTimer = window.setTimeout(saveDraft, 250);
        return;
      }
      draftSaving = true;
      const revision = draftRevision;
      const message = messageTextarea.value;
      try {
        await request("/api/chat/draft", {
          method: "PUT",
          auth: true,
          body: JSON.stringify({ message }),
        });
        if (revision === draftRevision) {
          setDraftStatus(message ? text.draftSaved : "", message ? "saved" : "");
        }
      } catch (error) {
        setDraftStatus(text.draftError, "error");
      } finally {
        draftSaving = false;
        if (revision !== draftRevision) draftTimer = window.setTimeout(saveDraft, 250);
      }
    }

    function scheduleDraftSave() {
      if (!sessionToken || conversationTerminated) return;
      draftRevision += 1;
      clearTimeout(draftTimer);
      setDraftStatus(text.draftSaving, "saving");
      draftTimer = window.setTimeout(saveDraft, 700);
    }

    function renderMessage(message) {
      if (message.senderType === "system") return;
      if (rendered.has(message.id)) return;
      rendered.add(message.id);
      const item = document.createElement("li");
      item.className = `site-chat__message site-chat__message--${message.senderType}`;
      const body = document.createElement("p");
      body.textContent = message.messageText;
      item.append(body);
      messagesNode.append(item);
      messagesNode.scrollTop = messagesNode.scrollHeight;
    }

    function showConversation() {
      conversationTerminated = false;
      widget.classList.add("site-chat--conversation");
      syncDevbarLayout();
      startForm.hidden = true;
      callbackForm.hidden = true;
      followupForm.hidden = true;
      conversationNode.hidden = false;
      messageForm.hidden = false;
      conversationActions.hidden = false;
      closedActions.hidden = true;
      messageForm.querySelectorAll("textarea, button").forEach((element) => { element.disabled = false; });
      loadDraft();
    }

    function showStart() {
      widget.classList.remove("site-chat--conversation");
      syncDevbarLayout();
      startForm.hidden = false;
      conversationNode.hidden = true;
      callbackForm.hidden = true;
      followupForm.hidden = true;
    }

    function showClosedConversation(allowNewConversation) {
      conversationTerminated = true;
      widget.classList.add("site-chat--conversation");
      syncDevbarLayout();
      clearTimeout(pollTimer);
      clearTimeout(draftTimer);
      setDraftStatus("");
      startForm.hidden = true;
      callbackForm.hidden = true;
      followupForm.hidden = true;
      conversationNode.hidden = false;
      messageForm.hidden = true;
      conversationActions.hidden = true;
      closedActions.hidden = !allowNewConversation;
      setStatus(text.closed, "closed");
      setPollState("idle", "Conversation closed; polling stopped");
    }

    function resetConversation() {
      clearTimeout(pollTimer);
      clearTimeout(draftTimer);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      sessionToken = "";
      conversationId = "";
      submissionToken = "";
      resetTurnstile();
      cursor = 0;
      backoff = OPEN_INTERVAL;
      followupShown = false;
      conversationTerminated = false;
      draftLoadedFor = "";
      draftRevision = 0;
      draftSaving = false;
      setDraftStatus("");
      rendered.clear();
      messagesNode.replaceChildren();
      startForm.reset();
      messageForm.reset();
      callbackForm.reset();
      followupForm.reset();
      messageForm.hidden = false;
      conversationActions.hidden = false;
      closedActions.hidden = true;
      messageForm.querySelectorAll("textarea, button").forEach((element) => { element.disabled = false; });
      setStatus("");
      showStart();
      ensureTurnstile();
      setPollState("idle", "No active conversation to poll");
      refreshAvailability();
      startForm.elements.name.focus();
    }

    function schedulePoll(delay) {
      clearTimeout(pollTimer);
      if (document.hidden) {
        if (messageTextarea.value && sessionToken) saveDraft();
        setPollState("warn", "Page hidden; polling paused");
        return;
      }
      if (!sessionToken) {
        setPollState("idle", "No active conversation to poll");
        return;
      }
      pollTimer = window.setTimeout(poll, delay);
    }

    async function poll() {
      if (polling || document.hidden || !sessionToken) return;
      polling = true;
      setPollState("checking", "Checking for new website messages");
      try {
        const result = await request(`/api/chat/messages?after=${cursor}`, { auth: true });
        result.messages.forEach(renderMessage);
        cursor = result.cursor;
        applyAvailability(result.availability);
        if (statusNode.dataset.state === "error" && statusNode.textContent === text.network) {
          setStatus("");
        }
        if (draftStatusNode.dataset.state === "error" && messageTextarea.value) {
          scheduleDraftSave();
        }
        backoff = OPEN_INTERVAL;
        setPollState("ok", panel.hidden ? "Connected · next check in 15s" : "Connected · next check in 3s");
        if (result.status === "closed" || result.status === "spam") {
          showClosedConversation(result.status === "closed");
          return;
        } else if (result.followUpSuggested && !followupShown) {
          followupShown = true;
          setStatus(text.followup, "info");
          followupForm.hidden = false;
          conversationNode.hidden = true;
        }
        schedulePoll(panel.hidden ? MINIMIZED_INTERVAL : OPEN_INTERVAL);
      } catch (error) {
        if (error.status === 401) {
          resetConversation();
          return;
        }
        setStatus(text.network, "error");
        setPollState("error", "Polling failed; retrying with backoff");
        backoff = Math.min(MAX_BACKOFF, Math.max(OPEN_INTERVAL, backoff * 2));
        schedulePoll(backoff + Math.floor(Math.random() * 500));
      } finally {
        polling = false;
      }
    }

    const normalizeContactPath = (pathname) => pathname.replace(/\/+$/, "") || "/";
    const contactPaths = new Set(["/contact", "/ru/contact"]);
    const contactTriggers = new Set(document.querySelectorAll("[data-chat-contact-open]"));
    document.querySelectorAll("a[href]").forEach((link) => {
      try {
        if (contactPaths.has(normalizeContactPath(new URL(link.href, location.href).pathname))) {
          contactTriggers.add(link);
        }
      } catch (_) {}
    });
    contactTriggers.forEach((trigger) => {
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", panel.id);
      trigger.setAttribute("aria-expanded", "false");
    });

    function setContactExpanded(expanded) {
      launcher.setAttribute("aria-expanded", String(expanded));
      contactTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", String(expanded)));
    }

    function closeMobileNavigation() {
      const expandedNavigation = document.querySelector(".navbar-collapse.show");
      const navigationToggle = document.querySelector(".navbar-toggler[aria-expanded='true']");
      if (expandedNavigation && navigationToggle instanceof HTMLElement) navigationToggle.click();
    }

    function openPanel() {
      panel.hidden = false;
      setContactExpanded(true);
      launcher.hidden = true;
      closeMobileNavigation();
      syncDevbarLayout();
      refreshAvailability();
      if (!sessionToken) ensureTurnstile();
      (panel.querySelector("input:not([tabindex='-1']), textarea, button") || panel).focus?.();
      if (sessionToken) {
        if (!conversationTerminated) showConversation();
        schedulePoll(0);
      }
    }

    function openFromContact(event) {
      event.preventDefault();
      openPanel();
    }

    function minimizePanel() {
      panel.hidden = true;
      launcher.hidden = false;
      setContactExpanded(false);
      launcher.focus();
      syncDevbarLayout();
      schedulePoll(MINIMIZED_INTERVAL);
    }

    launcher.addEventListener("click", openPanel);
    contactTriggers.forEach((trigger) => trigger.addEventListener("click", openFromContact));
    minimize.addEventListener("click", minimizePanel);
    if (contactPaths.has(normalizeContactPath(location.pathname))) {
      window.requestAnimationFrame(openPanel);
    }
    devbar?.querySelector("[data-dev-refresh]")?.addEventListener("click", () => refreshDevStatus());
    devbar?.querySelector("[data-dev-help-close]")?.addEventListener("click", closeDevHelp);
    devbar?.querySelectorAll("[data-dev-indicator]").forEach((indicator) => {
      indicator.addEventListener("click", () => toggleDevHelp(indicator));
    });
    window.addEventListener("resize", syncDevbarLayout);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && devHelpPanel && !devHelpPanel.hidden) {
        closeDevHelp();
        return;
      }
      if (event.key === "Escape" && !panel.hidden) {
        minimizePanel();
        return;
      }
      if (event.key !== "Tab" || panel.hidden || panel.getAttribute("aria-modal") !== "true") return;
      const focusable = Array.from(
        panel.querySelectorAll("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])"),
      ).filter((element) => !element.disabled && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.addEventListener("visibilitychange", () => {
      clearTimeout(pollTimer);
      clearTimeout(devStatusTimer);
      if (document.hidden) {
        setPollState("warn", "Page hidden; polling paused");
      } else {
        if (sessionToken) schedulePoll(0);
        refreshAvailability();
        refreshDevStatus();
      }
    });

    startForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = startForm.querySelector("button[type='submit']");
      const data = new FormData(startForm);
      if (!ensureTurnstile()) return;
      if (!turnstileToken || !turnstileIdempotencyKey) {
        setStatus(text.securityRequired, "security");
        return;
      }
      button.disabled = true;
      setStatus(text.sending, "pending");
      try {
        const result = await request("/api/chat/start", {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"), email: data.get("email"), phone: data.get("phone"),
            message: data.get("message"), website: data.get("website"), timezone,
            submissionToken, clientMessageId: randomId(), locale: language,
            turnstileToken, turnstileIdempotencyKey,
          }),
        });
        sessionToken = result.sessionToken;
        conversationId = result.conversationId;
        try { localStorage.setItem(STORAGE_KEY, sessionToken); } catch (_) {}
        result.messages.forEach(renderMessage);
        cursor = result.cursor;
        applyAvailability(result.availability);
        setStatus("");
        const name = String(data.get("name") || "");
        const phone = String(data.get("phone") || "");
        const email = String(data.get("email") || "");
        callbackForm.elements.name.value = name;
        callbackForm.elements.phone.value = phone;
        callbackForm.elements.email.value = email;
        showConversation();
        schedulePoll(OPEN_INTERVAL);
      } catch (error) {
        setStatus(error.message || text.network, "error");
        if (error.status === 400 || error.status === 429) {
          resetTurnstile();
          await refreshAvailability();
        }
      } finally {
        button.disabled = false;
      }
    });

    messageTextarea.addEventListener("input", scheduleDraftSave);

    messageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = messageForm.elements.message;
      const message = textarea.value.trim();
      if (!message) return;
      const button = messageForm.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const result = await request("/api/chat/message", {
          method: "POST", auth: true,
          body: JSON.stringify({ message, clientMessageId: randomId() }),
        });
        renderMessage({ id: result.messageId, senderType: "visitor", messageText: message, createdAt: result.createdAt });
        cursor = Math.max(cursor, result.messageId);
        clearTimeout(draftTimer);
        draftRevision += 1;
        textarea.value = "";
        setDraftStatus("");
        setStatus("");
      } catch (error) {
        setStatus(error.message || text.network, "error");
      } finally {
        button.disabled = false;
        textarea.focus();
      }
    });

    widget.querySelector("[data-chat-callback-open]").addEventListener("click", () => {
      conversationNode.hidden = true;
      followupForm.hidden = true;
      callbackForm.hidden = false;
      callbackForm.elements.name.focus();
    });
    widget.querySelector("[data-chat-callback-cancel]").addEventListener("click", showConversation);
    widget.querySelector("[data-chat-followup-cancel]").addEventListener("click", showConversation);

    callbackForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(callbackForm);
      const button = callbackForm.querySelector("button[type='submit']");
      button.disabled = true;
      setStatus(text.sending, "pending");
      try {
        const preferredValue = String(data.get("preferredTime") || "");
        await request("/api/chat/callback", {
          method: "POST", auth: true,
          body: JSON.stringify({
            name: data.get("name"), phone: data.get("phone"), email: data.get("email"),
            reason: data.get("reason"),
            preferredCallbackAt: preferredValue ? new Date(preferredValue).toISOString() : null,
            timezone, consent: data.get("consent") === "on",
          }),
        });
        showConversation();
        setStatus(text.callbackSaved, "success");
      } catch (error) {
        setStatus(error.message || text.network, "error");
      } finally { button.disabled = false; }
    });

    followupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(followupForm);
      const button = followupForm.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        await request("/api/chat/contact", {
          method: "POST", auth: true,
          body: JSON.stringify({ email: data.get("email"), phone: data.get("phone") }),
        });
        showConversation();
        setStatus(text.contactSaved, "success");
      } catch (error) { setStatus(error.message || text.network, "error"); }
      finally { button.disabled = false; }
    });

    newConversationButton.addEventListener("click", resetConversation);

    widget.querySelector("[data-chat-close]").addEventListener("click", async () => {
      try {
        await request("/api/chat/close", { method: "POST", auth: true, body: "{}" });
        showClosedConversation(true);
      } catch (error) { setStatus(error.message || text.network, "error"); }
    });

    refreshAvailability();
    setDevIndicator("site", "ok", "Hugo page rendered at " + location.host);
    syncDevbarLayout();
    refreshDevStatus();
    if (sessionToken) {
      showConversation();
      schedulePoll(0);
    } else {
      showStart();
      setPollState("idle", "No active conversation to poll");
    }
  }

  document.querySelectorAll("[data-chat-widget]").forEach(init);
})();
