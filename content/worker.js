const ALLOWED_ORIGINS = [
  "https://www.f12.biz",
  "https://f12.biz",
  "https://f12-biz.pages.dev",
  "https://netlify.f12.biz",
  "https://f12-biz.netlify.app"
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
    // add if you use cookies/credentials: "Access-Control-Allow-Credentials": "true",
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

    const textMessage =
      `New message:\n` +
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
