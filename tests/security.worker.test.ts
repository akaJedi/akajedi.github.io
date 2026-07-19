import { expect, it } from "vitest";
import { createChallenge, getAllowedOrigins, verifyChallenge } from "../src/lib";

const secret = "test-session-hash-secret-with-sufficient-entropy";

it("rejects instant and expired signed submissions", async () => {
  const now = Date.now();
  const instant = await createChallenge(secret, now - 500);
  await expect(verifyChallenge(secret, instant, now)).rejects.toMatchObject({
    status: 429,
    code: "submitted_too_fast",
  });
  const expired = await createChallenge(secret, now - 2 * 60 * 60 * 1000 - 1);
  await expect(verifyChallenge(secret, expired, now)).rejects.toMatchObject({
    status: 400,
    code: "challenge_expired",
  });
});

it("rejects a forged submission challenge", async () => {
  const challenge = await createChallenge(secret, Date.now() - 3000);
  await expect(verifyChallenge(secret, `${challenge.slice(0, -1)}x`)).rejects.toMatchObject({
    code: "challenge_invalid",
  });
});

it("parses configured origins as exact matches", () => {
  const allowed = getAllowedOrigins({
    ALLOWED_ORIGIN: "https://www.f12.biz,https://f12.biz",
  } as any);
  expect(allowed.has("https://www.f12.biz")).toBe(true);
  expect(allowed.has("https://attacker.example")).toBe(false);
  expect(allowed.has("https://www.f12.biz.attacker.example")).toBe(false);
});
