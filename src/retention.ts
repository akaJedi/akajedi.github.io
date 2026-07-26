import type { Env } from "./types";

export function isEligibleForRetentionCleanup(
  status: string,
  terminalTimestamp: string | null,
  env: Pick<Env, "CLOSED_RETENTION_DAYS" | "SPAM_RETENTION_DAYS">,
  now = new Date(),
): boolean {
  if (!terminalTimestamp || (status !== "closed" && status !== "spam")) return false;
  const timestamp = Date.parse(terminalTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const days = Number(
    status === "spam" ? env.SPAM_RETENTION_DAYS || "30" : env.CLOSED_RETENTION_DAYS || "180",
  );
  if (!Number.isFinite(days) || days < 1) return false;
  return now.getTime() - timestamp >= days * 24 * 60 * 60 * 1000;
}

export interface RetentionCleanupResult {
  eligibleConversationIds: string[];
  deleted: boolean;
}

// Finds closed/spam conversations past their retention window and, only when
// RETENTION_CLEANUP_ENABLED is explicitly "true", deletes them (cascading by
// hand to every dependent table in one atomic batch, rather than relying on
// D1's default per-connection foreign_keys pragma state). Left unset, this
// runs in log-only mode: it reports what it would delete but touches nothing
// — see ROADMAP.md, which calls for explicit sign-off before real deletion.
export async function findAndCleanupEligibleConversations(
  env: Pick<Env, "DB" | "CLOSED_RETENTION_DAYS" | "SPAM_RETENTION_DAYS" | "RETENTION_CLEANUP_ENABLED">,
  now = new Date(),
): Promise<RetentionCleanupResult> {
  const { results } = await env.DB.prepare(
    "SELECT id, status, closed_at FROM conversations WHERE status IN ('closed', 'spam') AND closed_at IS NOT NULL",
  ).all<{ id: string; status: string; closed_at: string | null }>();

  const eligibleConversationIds = (results || [])
    .filter((row) => isEligibleForRetentionCleanup(row.status, row.closed_at, env, now))
    .map((row) => row.id);

  if (eligibleConversationIds.length === 0 || env.RETENTION_CLEANUP_ENABLED !== "true") {
    return { eligibleConversationIds, deleted: false };
  }

  const statements = eligibleConversationIds.flatMap((id) => [
    env.DB.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM callback_requests WHERE conversation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM telegram_message_map WHERE conversation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM telegram_outbox WHERE conversation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM conversation_drafts WHERE conversation_id = ?").bind(id),
    env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(id),
  ]);
  await env.DB.batch(statements);

  return { eligibleConversationIds, deleted: true };
}
