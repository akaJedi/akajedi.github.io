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
