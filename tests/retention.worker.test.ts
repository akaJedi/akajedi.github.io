import { describe, expect, it } from "vitest";
import { isEligibleForRetentionCleanup } from "../src/retention";

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
