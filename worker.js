function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://www.f12.biz",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST allowed', {
        status: 405,
        headers: corsHeaders(),
      });
    }

    const contentType = request.headers.get('content-type') || '';
    let formData;

    if (contentType.includes('application/json')) {
      formData = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      formData = Object.fromEntries(new URLSearchParams(text));
    } else {
      return new Response('Unsupported content type', {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // === 🛡️ Flood Protection (per IP)
    const clientIP = request.headers.get("CF-Connecting-IP");
    const recentKey = `flood-${clientIP}`;
    const recent = await env.FLOOD_CACHE.get(recentKey);
    if (recent) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    await env.FLOOD_CACHE.put(recentKey, "1", { expirationTtl: 60 }); // 1 minute lockout

    // === 🕵️‍♂️ Secret Honeypot
    if (formData.secret_field !== "123abc456") {
      return new Response("Bot detected", {
        status: 403,
        headers: corsHeaders(),
      });
    }

    // === ✅ Field Validation
    const name = formData.name || formData.full_name || '';
    const email = formData.email || '';
    const message = formData.message || '';
    const phone = formData.phone || '';

    if (!name || !email || !message) {
      return new Response("Missing required fields", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response("Invalid email format", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // === 📩 Prepare Telegram message
    const textMessage =
      `🆕 New message from f12.biz:\n` +
      `👤 ${name}\n` +
      `📧 ${email}\n` +
      (phone ? `📱 ${phone}\n` : '') +
      `📝 ${message}`;

    const telegramURL = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;

    await fetch(telegramURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: textMessage,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  },
};
