const ALLOWED_ORIGINS = [
  "http://localhost:1313",
  "http://127.0.0.1:1313",
  "https://www.f12.biz",
  "https://f12.biz",
  "https://cloudflare.f12.biz",
  "https://f12-biz.pages.dev",
  "https://netlify.f12.biz",
  "https://f12-biz.netlify.app",
  "https://github.f12.biz"
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "https://www.f12.biz";
  const reqHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405, headers: corsHeaders(request) });
    }

    // Identify which site/page sent the request
    const hdrOrigin  = request.headers.get("Origin")   || "";
    const hdrReferer = request.headers.get("Referer")  || "";
    let siteOrigin = "";
    let siteHost   = "";
    let sitePage   = "";

    try {
      if (hdrOrigin) {
        const u = new URL(hdrOrigin);
        siteOrigin = u.origin;
        siteHost   = u.host;
      }
    } catch (_) {}
    try {
      if (hdrReferer) {
        const r = new URL(hdrReferer);
        if (!siteOrigin) { // if Origin missing, fall back to Referer origin
          siteOrigin = r.origin;
          siteHost   = r.host;
        }
        sitePage = r.href; // full page URL for context
      }
    } catch (_) {}

    const contentType = request.headers.get("content-type") || "";
    let formData;
    if (contentType.includes("application/json")) {
      formData = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      formData = Object.fromEntries(new URLSearchParams(text));
    } else {
      return new Response("Unsupported content type", { status: 400, headers: corsHeaders(request) });
    }

    const name = formData.name?.trim();
    const email = formData.email?.trim();
    const message = formData.message?.trim();
    const phone = formData.phone?.trim() || "";
    const honeypot = formData.secret_field?.trim();

    // Bonus: drop bots filling the honeypot
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    // Build the message, including the sending site
    const siteLine = siteHost
      ? `🌐 Site: ${siteHost}${sitePage ? `\n🔗 Page: ${sitePage}` : ""}`
      : `🌐 Site: (unknown)\n${hdrOrigin ? `Origin: ${hdrOrigin}\n` : ""}${hdrReferer ? `Referer: ${hdrReferer}\n` : ""}`;

    const textMessage =
      `New message:\n` +
      `${siteLine}\n` +
      `\n` +
      `👤 ${name}\n` +
      `📧 ${email}\n` +
      (phone ? `📱 ${phone}\n` : "") +
      `📝 ${message}`;

    const telegramURL = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
    const tgRes = await fetch(telegramURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: textMessage }),
    });

    if (!tgRes.ok) {
      const t = await tgRes.text();
      return new Response(JSON.stringify({ success: false, error: "Telegram error", details: t }), {
        status: 502,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    });
  },
};
