import {
  availability,
  escapeTelegram,
  formatLosAngeles,
  safeLog,
} from "./lib";
import type { ConversationRow, Env, TelegramResponse } from "./types";

interface OutboxRow {
  id: number;
  conversation_id: string;
  source_type: "message" | "callback";
  source_id: number;
  attempts: number;
}

interface Notification {
  text: string;
  buttons: Array<Array<{ text: string; callback_data: string }>>;
  replyEnabled: boolean;
}

function credentials(env: Env): { token: string; chatId: string } | null {
  const token = env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN;
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}

export async function telegramCall(
  env: Env,
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramResponse> {
  const auth = credentials(env);
  if (!auth) throw new Error("telegram_configuration_missing");
  const response = await fetch(`https://api.telegram.org/bot${auth.token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({ ok: false }))) as TelegramResponse;
  if (!response.ok || !result.ok) throw new Error(`telegram_${response.status}`);
  return result;
}

function actionButtons(publicNumber: number, replyEnabled = true): Notification["buttons"] {
  return [
    [
      ...(replyEnabled ? [{ text: "How to reply", callback_data: `reply:${publicNumber}` }] : []),
      { text: "Callback pending", callback_data: `status:callback_pending:${publicNumber}` },
    ],
    [
      { text: "Mark contacted", callback_data: `status:contacted:${publicNumber}` },
      { text: "Close", callback_data: `status:closed:${publicNumber}` },
    ],
  ];
}

async function messageNotification(env: Env, sourceId: number): Promise<Notification | null> {
  const row = await env.DB.prepare(
    `SELECT m.message_text, m.created_at, c.public_number, c.visitor_name,
            c.visitor_email, c.visitor_phone, c.status, c.source_type, c.source_page
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ? AND m.sender_type = 'visitor'`,
  )
    .bind(sourceId)
    .first<Record<string, string | number | null>>();
  if (!row) return null;
  const isContactForm = row.source_type === "contact_form";
  const quiet = !availability(env, new Date(String(row.created_at))).available;
  const email = row.visitor_email
    ? `<a href="mailto:${encodeURIComponent(String(row.visitor_email))}">${escapeTelegram(String(row.visitor_email))}</a>`
    : "Not provided";
  const text = [
    `<b>${isContactForm ? "New contact form lead" : "New website chat"} #${row.public_number}</b>`,
    "",
    `<b>Name:</b> ${escapeTelegram(String(row.visitor_name))}`,
    `<b>Email:</b> ${email}`,
    `<b>Phone:</b> ${row.visitor_phone ? escapeTelegram(String(row.visitor_phone)) : "Not provided"}`,
    `<b>Received:</b> ${escapeTelegram(formatLosAngeles(new Date(String(row.created_at)), env.OWNER_TIMEZONE))}`,
    `<b>Status:</b> ${escapeTelegram(String(row.status))}`,
    `<b>Source:</b> ${isContactForm ? "Contact form" : "Website chat"}`,
    ...(row.source_page ? [`<b>Page:</b> ${escapeTelegram(String(row.source_page))}`] : []),
    `<b>Quiet hours:</b> ${quiet ? "Yes — Received during quiet hours" : "No"}`,
    "",
    "<b>Message:</b>",
    escapeTelegram(String(row.message_text).slice(0, 2600)),
    "",
    isContactForm
      ? "Follow up using the visitor’s email or phone. Telegram replies are disabled for contact-form leads because the visitor has no active chat session."
      : "To answer: use Telegram’s native Reply action on this notification, then send your message.",
  ].join("\n");
  return {
    text,
    buttons: actionButtons(Number(row.public_number), !isContactForm),
    replyEnabled: !isContactForm,
  };
}

async function callbackNotification(env: Env, sourceId: number): Promise<Notification | null> {
  const row = await env.DB.prepare(
    `SELECT r.*, c.public_number
       FROM callback_requests r JOIN conversations c ON c.id = r.conversation_id
      WHERE r.id = ?`,
  )
    .bind(sourceId)
    .first<Record<string, string | number | null>>();
  if (!row) return null;
  const quiet = !availability(env, new Date(String(row.created_at))).available;
  const preferred = row.preferred_callback_at
    ? `${String(row.preferred_callback_at)} (${String(row.visitor_timezone || "timezone not provided")})`
    : "Not provided";
  const text = [
    `<b>Callback request — website chat #${row.public_number}</b>`,
    "",
    `<b>Name:</b> ${escapeTelegram(String(row.name))}`,
    `<b>Phone:</b> ${escapeTelegram(String(row.phone_original))}`,
    `<b>Email:</b> ${row.email ? escapeTelegram(String(row.email)) : "Not provided"}`,
    `<b>Reason:</b> ${escapeTelegram(String(row.reason).slice(0, 1900))}`,
    `<b>Preferred time:</b> ${escapeTelegram(preferred)}`,
    `<b>Visitor timezone:</b> ${escapeTelegram(String(row.visitor_timezone || "Not provided"))}`,
    `<b>Received:</b> ${escapeTelegram(formatLosAngeles(new Date(String(row.created_at)), env.OWNER_TIMEZONE))}`,
    `<b>Quiet hours:</b> ${quiet ? "Yes — Received during quiet hours" : "No"}`,
    "",
    "To answer: use Telegram’s native Reply action on this notification, then send your message.",
  ].join("\n");
  return { text, buttons: actionButtons(Number(row.public_number)), replyEnabled: true };
}

export async function queueNotification(
  env: Env,
  conversationId: string,
  sourceType: "message" | "callback",
  sourceId: number,
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO telegram_outbox
       (conversation_id, source_type, source_id, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(conversationId, sourceType, sourceId, now, now)
    .run();
}

export async function repairOutbox(env: Env): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO telegram_outbox
         (conversation_id, source_type, source_id, next_attempt_at, created_at)
       SELECT conversation_id, 'message', id, ?, created_at
         FROM messages
        WHERE sender_type = 'visitor' AND telegram_notified_at IS NULL`,
    ).bind(now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO telegram_outbox
         (conversation_id, source_type, source_id, next_attempt_at, created_at)
       SELECT conversation_id, 'callback', id, ?, created_at
         FROM callback_requests
        WHERE telegram_notified_at IS NULL`,
    ).bind(now),
  ]);
}

export async function flushOutbox(env: Env, limit = 10): Promise<void> {
  if (!credentials(env)) return;
  await repairOutbox(env);
  const rows = await env.DB.prepare(
    `SELECT id, conversation_id, source_type, source_id, attempts
       FROM telegram_outbox
      WHERE delivered_at IS NULL AND next_attempt_at <= ?
      ORDER BY id LIMIT ?`,
  )
    .bind(new Date().toISOString(), limit)
    .all<OutboxRow>();
  for (const row of rows.results) {
    const claimTime = new Date().toISOString();
    const leaseUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const claim = await env.DB.prepare(
      "UPDATE telegram_outbox SET next_attempt_at = ? WHERE id = ? AND delivered_at IS NULL AND next_attempt_at <= ?",
    ).bind(leaseUntil, row.id, claimTime).run();
    if ((claim.meta.changes || 0) === 0) continue;
    try {
      const notification =
        row.source_type === "message"
          ? await messageNotification(env, row.source_id)
          : await callbackNotification(env, row.source_id);
      if (!notification) continue;
      const auth = credentials(env)!;
      const sent = await telegramCall(env, "sendMessage", {
        chat_id: auth.chatId,
        text: notification.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: notification.buttons },
      });
      const messageId = sent.result?.message_id;
      if (!messageId) throw new Error("telegram_message_id_missing");
      const now = new Date().toISOString();
      const sourceTable = row.source_type === "message" ? "messages" : "callback_requests";
      const updates = [
        env.DB.prepare(`UPDATE ${sourceTable} SET telegram_notified_at = ? WHERE id = ?`).bind(
          now,
          row.source_id,
        ),
        env.DB.prepare(
          "UPDATE telegram_outbox SET delivered_at = ?, attempts = attempts + 1, last_error_code = NULL WHERE id = ?",
        ).bind(now, row.id),
      ];
      if (notification.replyEnabled) {
        updates.unshift(
          env.DB.prepare(
            `INSERT OR IGNORE INTO telegram_message_map
               (telegram_chat_id, telegram_message_id, conversation_id, created_at)
             VALUES (?, ?, ?, ?)`,
          ).bind(auth.chatId, messageId, row.conversation_id, now),
        );
      }
      await env.DB.batch(updates);
    } catch (error) {
      const attempts = row.attempts + 1;
      const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10) * 15);
      const next = new Date(Date.now() + delaySeconds * 1000).toISOString();
      const code = error instanceof Error ? error.message.slice(0, 80) : "telegram_unknown";
      await env.DB.prepare(
        `UPDATE telegram_outbox
            SET attempts = attempts + 1, next_attempt_at = ?, last_error_code = ?
          WHERE id = ?`,
      )
        .bind(next, code, row.id)
        .run();
      safeLog("telegram_delivery_failed", { outboxId: row.id, attempts });
    }
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

async function listCommand(env: Env, command: string, page: number): Promise<string> {
  const offset = (page - 1) * 10;
  let where = "c.status NOT IN ('closed', 'spam')";
  if (command === "pending") where = "c.status = 'pending'";
  if (command === "callbacks") where = "c.status = 'callback_pending'";
  const rows = await env.DB.prepare(
    `SELECT c.public_number, c.visitor_name, c.status, c.updated_at
       FROM conversations c WHERE ${where}
      ORDER BY c.updated_at DESC LIMIT 11 OFFSET ?`,
  )
    .bind(offset)
    .all<Record<string, string | number>>();
  const items = rows.results.slice(0, 10);
  if (!items.length) return `No ${command} conversations on page ${page}.`;
  const lines = items.map(
    (row) =>
      `#${row.public_number} — ${escapeTelegram(String(row.visitor_name))} — ${statusLabel(String(row.status))}`,
  );
  if (rows.results.length > 10) lines.push(`\nNext: /${command} ${page + 1}`);
  return `<b>${command[0].toUpperCase()}${command.slice(1)} — page ${page}</b>\n\n${lines.join("\n")}`;
}

async function setConversationStatus(env: Env, publicNumber: number, status: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE conversations
        SET status = ?, updated_at = ?, closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END
      WHERE public_number = ?`,
  )
    .bind(status, now, status, now, publicNumber)
    .run();
  if (status === "contacted") {
    await env.DB.prepare(
      `UPDATE callback_requests SET status = 'contacted', contacted_at = ?
        WHERE conversation_id = (SELECT id FROM conversations WHERE public_number = ?)
          AND status = 'callback_pending'`,
    )
      .bind(now, publicNumber)
      .run();
  }
  return (result.meta.changes || 0) > 0;
}

export async function processTelegramUpdate(env: Env, update: Record<string, any>): Promise<void> {
  const adminId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (!adminId) throw new Error("telegram_admin_missing");
  const message = update.message;
  const callback = update.callback_query;
  const incomingChat = String(message?.chat?.id ?? callback?.message?.chat?.id ?? "");
  if (incomingChat !== String(adminId)) return;

  if (callback) {
    const data = String(callback.data || "");
    let answer = "Action not recognized.";
    if (data.startsWith("reply:")) {
      answer = "Use Telegram’s Reply action on this notification, then send your message. It will appear in the website chat.";
    } else {
      const match = /^status:(callback_pending|contacted|closed):(\d+)$/.exec(data);
      if (match) {
        answer = (await setConversationStatus(env, Number(match[2]), match[1]))
          ? `Conversation #${match[2]} marked ${statusLabel(match[1])}.`
          : "Conversation not found.";
      }
    }
    await telegramCall(env, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: answer,
      show_alert: data.startsWith("reply:"),
    });
    return;
  }

  if (!message?.text) return;
  const text = String(message.text).trim();
  if (text.startsWith("/")) {
    const [rawCommand, rawArg] = text.split(/\s+/, 2);
    const command = rawCommand.split("@")[0].slice(1).toLowerCase();
    let reply = "Unknown command. Use /help.";
    if (["open", "pending", "callbacks"].includes(command)) {
      const page = Math.max(1, Math.min(100, Number(rawArg) || 1));
      reply = await listCommand(env, command, page);
    } else if (["close", "contacted"].includes(command)) {
      const number = Number(rawArg);
      if (!Number.isInteger(number) || number < 1) {
        reply = `Usage: /${command} CONVERSATION_NUMBER`;
      } else {
        const status = command === "close" ? "closed" : "contacted";
        reply = (await setConversationStatus(env, number, status))
          ? `Conversation #${number} marked ${status}.`
          : "Conversation not found.";
      }
    } else if (command === "help") {
      reply = [
        "<b>Website chat commands</b>",
        "/open [page]", "/pending [page]", "/callbacks [page]",
        "/close CONVERSATION_NUMBER", "/contacted CONVERSATION_NUMBER", "/help",
        "", "To answer a visitor, use Telegram’s Reply action on their notification, then send your message.",
      ].join("\n");
    }
    await telegramCall(env, "sendMessage", {
      chat_id: adminId,
      text: reply,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    return;
  }

  const replyTo = message.reply_to_message?.message_id;
  if (!replyTo) {
    await telegramCall(env, "sendMessage", {
      chat_id: adminId,
      text: "To answer a website visitor, use Telegram’s Reply action on that visitor’s bot notification, then send your message.",
    });
    return;
  }
  const conversation = await env.DB.prepare(
    `SELECT c.* FROM telegram_message_map tm
      JOIN conversations c ON c.id = tm.conversation_id
     WHERE tm.telegram_chat_id = ? AND tm.telegram_message_id = ?`,
  )
    .bind(adminId, replyTo)
    .first<ConversationRow>();
  if (!conversation) {
    await telegramCall(env, "sendMessage", {
      chat_id: adminId,
      text: "That message is not linked to a website conversation. Please use Reply on the visitor’s original bot notification.",
    });
    return;
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO messages
         (conversation_id, sender_type, message_text, telegram_message_id, created_at)
       VALUES (?, 'owner', ?, ?, ?)`,
    ).bind(conversation.id, text.slice(0, 4000), message.message_id, now),
    env.DB.prepare(
      `UPDATE conversations SET status = 'active', updated_at = ?, last_owner_message_at = ?
        WHERE id = ?`,
    ).bind(now, now, conversation.id),
  ]);
}

