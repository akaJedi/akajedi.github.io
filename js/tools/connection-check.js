(() => {
  "use strict";

  const page = document.querySelector("[data-tools-page]");
  if (!page) return;
  const apiBase = (page.dataset.apiBase || "").replace(/\/$/, "");
  const lang = document.documentElement.lang === "ru" ? "ru" : "en";

  const text = {
    en: {
      unavailable: "Unavailable",
      unknown: "Unknown",
      yes: "Yes",
      no: "No",
      networkError: "Could not reach the network check — this page still works, just without IP/network details.",
      timezoneMatch: "Your browser's timezone matches your IP-reported timezone.",
      timezoneMismatch: "Your browser's timezone doesn't match your IP-reported timezone — this can happen with a VPN, a travelling laptop, or just a manually-set clock.",
      webrtcNone: "No IP addresses were exposed through WebRTC in this browser.",
      webrtcUnsupported: "WebRTC is not available in this browser or was blocked.",
      webrtcFound: (ips) => `WebRTC exposed: ${ips.join(", ")}`,
    },
    ru: {
      unavailable: "Недоступно",
      unknown: "Неизвестно",
      yes: "Да",
      no: "Нет",
      networkError: "Не удалось получить сетевые данные — остальная часть страницы работает и без них.",
      timezoneMatch: "Часовой пояс браузера совпадает с часовым поясом по IP.",
      timezoneMismatch: "Часовой пояс браузера не совпадает с часовым поясом по IP — это бывает при использовании VPN, в поездке или при вручную изменённых часах.",
      webrtcNone: "WebRTC не раскрыл IP-адреса в этом браузере.",
      webrtcUnsupported: "WebRTC недоступен в этом браузере или заблокирован.",
      webrtcFound: (ips) => `WebRTC раскрыл: ${ips.join(", ")}`,
    },
  }[lang];

  function setField(name, value) {
    const el = page.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = value == null || value === "" ? text.unavailable : String(value);
  }

  function bytesLabel(gb) {
    if (!gb) return text.unknown;
    return `~${gb} GB`;
  }

  async function loadNetworkInfo() {
    if (!apiBase) {
      setField("ip", text.unavailable);
      return;
    }
    // Purely client-side, so it should show up regardless of whether the
    // network fetch below succeeds.
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    setField("browserTimezone", browserTimezone);

    try {
      const response = await fetch(`${apiBase}/api/whoami`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();

      setField("ip", data.ip);
      setField("protocolFamily", data.ip ? (data.ip.includes(":") ? "IPv6" : "IPv4") : text.unknown);
      setField("organization", data.network?.organization || (data.network?.asn ? `AS${data.network.asn}` : text.unknown));
      setField("httpProtocol", data.network?.httpProtocol);
      setField("tlsVersion", data.network?.tlsVersion);
      setField("dataCenter", data.network?.dataCenter);

      setField("country", data.location?.country);
      setField("region", data.location?.region);
      setField("city", data.location?.city);
      setField("ipTimezone", data.location?.timezone);

      const note = page.querySelector("[data-tool-timezone-note]");
      if (note && data.location?.timezone) {
        const matches = data.location.timezone === browserTimezone;
        note.textContent = matches ? text.timezoneMatch : text.timezoneMismatch;
        note.hidden = false;
      }
    } catch (_) {
      ["ip", "protocolFamily", "organization", "httpProtocol", "tlsVersion", "dataCenter",
        "country", "region", "city", "ipTimezone"].forEach((field) => setField(field, text.networkError));
    }
  }

  function loadDeviceInfo() {
    setField("userAgent", navigator.userAgent);
    setField("platform", navigator.userAgentData?.platform || navigator.platform);
    setField("languages", (navigator.languages || [navigator.language]).join(", "));
    setField("screen", `${screen.width}×${screen.height} (${screen.colorDepth}-bit)`);
    setField("viewport", `${window.innerWidth}×${window.innerHeight}`);
    setField("cores", navigator.hardwareConcurrency || text.unknown);
    setField("memory", bytesLabel(navigator.deviceMemory));

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    setField("connection", connection ? `${connection.effectiveType || text.unknown}${connection.saveData ? " (data saver)" : ""}` : text.unknown);

    setField("colorScheme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setField("reducedMotion", window.matchMedia("(prefers-reduced-motion: reduce)").matches ? text.yes : text.no);

    let cookiesEnabled = navigator.cookieEnabled;
    try {
      document.cookie = "f12_cookie_test=1; max-age=5";
      cookiesEnabled = document.cookie.includes("f12_cookie_test");
    } catch (_) {}
    setField("cookies", cookiesEnabled ? text.yes : text.no);
  }

  function checkWebrtcLeak() {
    const status = page.querySelector("[data-webrtc-status]");
    if (!status) return;
    const RTCPeerConnectionImpl = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (!RTCPeerConnectionImpl) {
      status.textContent = text.webrtcUnsupported;
      return;
    }

    const found = new Set();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      status.textContent = found.size ? text.webrtcFound([...found]) : text.webrtcNone;
    };

    try {
      const pc = new RTCPeerConnectionImpl({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
      pc.createDataChannel("");
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          pc.close();
          finish();
          return;
        }
        const match = /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(?::[a-f0-9]{0,4}){2,7})/i.exec(event.candidate.candidate);
        if (match) found.add(match[1]);
      };
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(finish);
      window.setTimeout(finish, 3000);
    } catch (_) {
      status.textContent = text.webrtcUnsupported;
    }
  }

  async function computeFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 220;
      canvas.height = 40;
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "16px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 220, 40);
      ctx.fillStyle = "#069";
      ctx.fillText("f12.biz fingerprint 🔒", 2, 15);
      ctx.strokeStyle = "rgba(120, 20, 60, 0.6)";
      ctx.strokeText("f12.biz fingerprint 🔒", 2, 15);

      const dataUrl = canvas.toDataURL();
      const encoded = new TextEncoder().encode(dataUrl);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
      setField("canvasHash", hash);
    } catch (_) {
      setField("canvasHash", text.unavailable);
    }

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
      if (gl && debugInfo) {
        setField("webglRenderer", gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        setField("webglVendor", gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
      } else {
        setField("webglRenderer", text.unavailable);
        setField("webglVendor", text.unavailable);
      }
    } catch (_) {
      setField("webglRenderer", text.unavailable);
      setField("webglVendor", text.unavailable);
    }
  }

  loadNetworkInfo();
  loadDeviceInfo();
  checkWebrtcLeak();
  computeFingerprint();
})();
