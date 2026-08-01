import { escapeTelegram, safeLog } from "./lib";
import { telegramCall } from "./telegram";
import type { Env } from "./types";

export type DomainWatchAlertEvent = "changed" | "diverged" | "converged" | "completed";

interface AlertRow {
  id: number;
  watch_id: string;
  sample_id: number | null;
  event_type: DomainWatchAlertEvent;
  attempts: number;
  domain: string;
  record_key: string;
  query_name: string;
  sample_count: number;
  change_count: number;
  created_at: string;
  sampled_at: string | null;
  state: string | null;
  cloudflare_json: string | null;
  google_json: string | null;
}

interface SampleEvidence {
  sampled_at: string;
  state: string;
  cloudflare_json: string;
  google_json: string;
}

interface ResolverEvidence {
  answers?: unknown;
  status?: unknown;
  error?: unknown;
}

const EVENT_HEADINGS: Record<DomainWatchAlertEvent, string> = {
  changed: "DNS answer changed",
  diverged: "DNS resolvers diverged",
  converged: "DNS resolvers converged",
  completed: "DNS watch completed",
};

function credentialsAvailable(env: Env): boolean {
  return Boolean(
    (env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN) &&
    (env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID),
  );
}

export function domainWatchAlertsEnabled(env: Env, domain: string): boolean {
  const configured = (env.DNS_WATCH_TELEGRAM_DOMAINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  const normalized = domain.toLowerCase().replace(/\.$/, "");
  return configured.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

export function classifyDomainWatchAlert(
  previousState: string | null,
  currentState: string,
  changed: boolean,
): DomainWatchAlertEvent | null {
  if (!previousState || !changed) return null;
  const divergent = (state: string) => state === "different" || state === "dnssec_disagreement";
  if (!divergent(previousState) && divergent(currentState)) return "diverged";
  if (divergent(previousState) && currentState === "match") return "converged";
  return "changed";
}

function parseEvidence(value: string | null): ResolverEvidence {
  if (!value) return {};
  try {
    return JSON.parse(value) as ResolverEvidence;
  } catch {
    return {};
  }
}

function formatResolver(value: string | null): string {
  const evidence = parseEvidence(value);
  const answers = Array.isArray(evidence.answers)
    ? evidence.answers.map(String).slice(0, 8).join(", ")
    : "";
  if (answers) return escapeTelegram(answers.slice(0, 500));
  if (typeof evidence.error === "string" && evidence.error) {
    return `error: ${escapeTelegram(evidence.error)}`;
  }
  return `no answer (DNS status ${escapeTelegram(String(evidence.status ?? "unknown"))})`;
}

function evidenceLines(label: string, sample: SampleEvidence | AlertRow): string[] {
  return [
    `<b>${escapeTelegram(label)}:</b> ${escapeTelegram(String(sample.state || "unknown"))}`,
    `  Cloudflare: ${formatResolver(sample.cloudflare_json)}`,
    `  Google: ${formatResolver(sample.google_json)}`,
  ];
}

async function alertText(env: Env, alert: AlertRow): Promise<string> {
  let previous: SampleEvidence | null = null;
  if (alert.sample_id) {
    previous = await env.DB.prepare(
      `SELECT sampled_at, state, cloudflare_json, google_json
         FROM domain_watch_samples
        WHERE watch_id = ? AND id < ?
        ORDER BY id DESC LIMIT 1`,
    ).bind(alert.watch_id, alert.sample_id).first<SampleEvidence>();
  }
  const eventAt = alert.sampled_at || alert.created_at;
  const timeline = `https://f12.biz/tools/domain-lookup/?domain=${encodeURIComponent(alert.domain)}&watch=${encodeURIComponent(alert.watch_id)}`;
  const lines = [
    `<b>${escapeTelegram(EVENT_HEADINGS[alert.event_type])}</b>`,
    "",
    `<b>Name:</b> ${escapeTelegram(alert.query_name)}`,
    `<b>Record:</b> ${escapeTelegram(alert.record_key)}`,
    `<b>Observed:</b> ${escapeTelegram(eventAt)}`,
  ];
  if (alert.event_type === "completed") {
    lines.push(
      `<b>Samples:</b> ${alert.sample_count}`,
      `<b>Changes:</b> ${alert.change_count}`,
    );
    if (alert.sample_id) lines.push("", ...evidenceLines("Final observation", alert));
  } else {
    if (previous) lines.push("", ...evidenceLines("Previous", previous));
    lines.push("", ...evidenceLines("Current", alert));
  }
  lines.push("", `<b>Timeline:</b> ${escapeTelegram(timeline)}`);
  return lines.join("\n");
}

export async function flushDomainWatchAlerts(env: Env, limit = 20): Promise<void> {
  if (!credentialsAvailable(env)) return;
  const rows = await env.DB.prepare(
    `SELECT a.id, a.watch_id, a.sample_id, a.event_type, a.attempts, a.created_at,
            w.domain, w.record_key, w.query_name, w.sample_count, w.change_count,
            s.sampled_at, s.state, s.cloudflare_json, s.google_json
       FROM domain_watch_alerts a
       JOIN domain_watches w ON w.id = a.watch_id
       LEFT JOIN domain_watch_samples s ON s.id = a.sample_id AND s.watch_id = a.watch_id
      WHERE a.delivered_at IS NULL AND a.next_attempt_at <= ?
      ORDER BY a.id LIMIT ?`,
  ).bind(new Date().toISOString(), limit).all<AlertRow>();

  for (const alert of rows.results) {
    const claimTime = new Date().toISOString();
    const leaseUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const claim = await env.DB.prepare(
      `UPDATE domain_watch_alerts SET next_attempt_at = ?
        WHERE id = ? AND delivered_at IS NULL AND next_attempt_at <= ?`,
    ).bind(leaseUntil, alert.id, claimTime).run();
    if ((claim.meta.changes || 0) === 0) continue;

    try {
      const chatId = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID;
      await telegramCall(env, "sendMessage", {
        chat_id: chatId,
        text: await alertText(env, alert),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{
            text: "Open timeline",
            url: `https://f12.biz/tools/domain-lookup/?domain=${encodeURIComponent(alert.domain)}&watch=${encodeURIComponent(alert.watch_id)}`,
          }]],
        },
      });
      await env.DB.prepare(
        `UPDATE domain_watch_alerts
            SET delivered_at = ?, attempts = attempts + 1, last_error_code = NULL
          WHERE id = ?`,
      ).bind(new Date().toISOString(), alert.id).run();
    } catch (error) {
      const attempts = alert.attempts + 1;
      const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10) * 15);
      const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      const code = error instanceof Error ? error.message.slice(0, 80) : "telegram_unknown";
      await env.DB.prepare(
        `UPDATE domain_watch_alerts
            SET attempts = attempts + 1, next_attempt_at = ?, last_error_code = ?
          WHERE id = ?`,
      ).bind(nextAttemptAt, code, alert.id).run();
      safeLog("domain_watch_alert_delivery_failed", { alertId: alert.id, attempts });
    }
  }
}
