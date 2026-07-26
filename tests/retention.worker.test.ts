/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import migrationSql from "../migrations/0001_chat.sql?raw";
import draftMigrationSql from "../migrations/0002_conversation_drafts.sql?raw";
import sourceMigrationSql from "../migrations/0003_conversation_sources.sql?raw";
import { findAndCleanupEligibleConversations, isEligibleForRetentionCleanup } from "../src/retention";
import type { Env } from "../src/types";

const config = { CLOSED_RETENTION_DAYS: "180", SPAM_RETENTION_DAYS: "30" };
const now = new Date("2026-07-18T12:00:00Z");

describe("retention eligibility remains non-destructive", () => {
  it("keeps open business conversations indefinitely", () => {
    expect(isEligibleForRetentionCleanup("active", "2020-01-01T00:00:00Z", config, now)).toBe(false);
    expect(isEligibleForRetentionCleanup("pending", "2020-01-01T00:00:00Z", config, now)).toBe(false);
  });

  it("uses separate closed and spam retention periods", () => {
    expect(isEligibleForRetentionCleanup("closed", "2026-01-19T11:59:59Z", config, now)).toBe(true);
    expect(isEligibleForRetentionCleanup("closed", "2026-01-20T12:00:01Z", config, now)).toBe(false);
    expect(isEligibleForRetentionCleanup("spam", "2026-06-18T11:59:59Z", config, now)).toBe(true);
    expect(isEligibleForRetentionCleanup("spam", "2026-06-19T12:00:01Z", config, now)).toBe(false);
  });

  it("does not select malformed or undated records", () => {
    expect(isEligibleForRetentionCleanup("closed", null, config, now)).toBe(false);
    expect(isEligibleForRetentionCleanup("spam", "not-a-date", config, now)).toBe(false);
  });
});

describe("findAndCleanupEligibleConversations", () => {
  const testEnv = env as unknown as Env;

  function migrationQueries(sql: string): string[] {
    return sql.split(";").map((query) => query.trim()).filter(Boolean);
  }

  beforeAll(async () => {
    const migrations = [
      ...migrationQueries(migrationSql),
      ...migrationQueries(draftMigrationSql),
      ...migrationQueries(sourceMigrationSql),
    ];
    await testEnv.DB.batch(migrations.map((query) => testEnv.DB.prepare(query)));
  });

  async function seedConversation(id: string, status: string, closedAt: string | null) {
    await testEnv.DB.batch([
      testEnv.DB.prepare(
        `INSERT INTO conversations
           (id, session_token_hash, visitor_name, status, created_at, updated_at, closed_at)
         VALUES (?, 'hash', 'Test Visitor', ?, '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z', ?)`,
      ).bind(id, status, closedAt),
      testEnv.DB.prepare(
        `INSERT INTO messages (conversation_id, sender_type, message_text, created_at)
         VALUES (?, 'visitor', 'hello', '2020-01-01T00:00:00Z')`,
      ).bind(id),
      testEnv.DB.prepare(
        `INSERT INTO conversation_drafts (conversation_id, message_text, updated_at)
         VALUES (?, 'draft', '2020-01-01T00:00:00Z')`,
      ).bind(id),
    ]);
  }

  it("finds eligible conversations but deletes nothing when RETENTION_CLEANUP_ENABLED is not set", async () => {
    await seedConversation("dry-run-eligible", "closed", "2020-01-01T00:00:00Z");

    const result = await findAndCleanupEligibleConversations(testEnv, now);

    expect(result.eligibleConversationIds).toContain("dry-run-eligible");
    expect(result.deleted).toBe(false);
    const stillThere = await testEnv.DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind("dry-run-eligible").first();
    expect(stillThere).not.toBeNull();
  });

  it("ignores conversations that are not yet past their retention window", async () => {
    await seedConversation("too-recent", "closed", "2026-07-01T00:00:00Z");

    const result = await findAndCleanupEligibleConversations(testEnv, now);

    expect(result.eligibleConversationIds).not.toContain("too-recent");
  });

  it("deletes an eligible conversation and every dependent row when explicitly enabled", async () => {
    await seedConversation("enabled-eligible", "spam", "2020-01-01T00:00:00Z");
    await seedConversation("enabled-not-eligible", "active", null);

    const result = await findAndCleanupEligibleConversations(
      { ...testEnv, RETENTION_CLEANUP_ENABLED: "true" },
      now,
    );

    expect(result.eligibleConversationIds).toContain("enabled-eligible");
    expect(result.eligibleConversationIds).not.toContain("enabled-not-eligible");
    expect(result.deleted).toBe(true);

    const conversation = await testEnv.DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind("enabled-eligible").first();
    expect(conversation).toBeNull();
    const messages = await testEnv.DB.prepare("SELECT id FROM messages WHERE conversation_id = ?")
      .bind("enabled-eligible").first();
    expect(messages).toBeNull();
    const draft = await testEnv.DB.prepare("SELECT conversation_id FROM conversation_drafts WHERE conversation_id = ?")
      .bind("enabled-eligible").first();
    expect(draft).toBeNull();

    const untouched = await testEnv.DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind("enabled-not-eligible").first();
    expect(untouched).not.toBeNull();
  });
});
