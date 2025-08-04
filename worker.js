function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://www.f12.biz",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    // Allow CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Allow only POST
    if (request.method !== "POST") {
      return new Response("Only POST allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    // Parse body
    const contentType = request.headers.get("content-type") || "";
    let formData;
    if (contentType.includes("application/json")) {
      formData = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      formData = Object.fromEntries(new URLSearchParams(text));
    } else {
      return new Response("Unsupported content type", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // Extract fields
    const name = formData.name?.trim();
    const email = formData.email?.trim();
    const message = formData.message?.trim();
    const phone = formData.phone?.trim() || "";
    const honeypot = formData.secret_field?.trim();

    // Required fields check
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Format Telegram message
    const textMessage =
      `New message:\n` +
      `👤 ${name}\n` +
      `📧 ${email}\n` +
      (phone ? `📱 ${phone}\n` : "") +
      `📝 ${message}`;

    // Send to Telegram
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
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
    });
  },
};
