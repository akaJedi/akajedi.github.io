import { cloudflarePool } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.worker.test.ts"],
    pool: cloudflarePool({
      main: "./src/worker.ts",
      miniflare: {
        compatibilityDate: "2026-06-01",
        d1Databases: ["DB"],
        bindings: {
          SESSION_HASH_SECRET: "test-session-hash-secret-with-sufficient-entropy",
          TELEGRAM_BOT_TOKEN: "test-bot-token",
          TELEGRAM_ADMIN_CHAT_ID: "424242",
          TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
          ALLOWED_ORIGIN: "https://www.f12.biz,http://localhost:1313",
          OWNER_TIMEZONE: "America/Los_Angeles",
          QUIET_HOURS_START: "23",
          QUIET_HOURS_END: "6",
          CLOSED_RETENTION_DAYS: "180",
          SPAM_RETENTION_DAYS: "30",
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          TURNSTILE_REQUIRED: "true",
          TURNSTILE_EXPECTED_HOSTNAMES: "www.f12.biz",
          TURNSTILE_TEST_MODE: "true",
          DNS_WATCH_TELEGRAM_DOMAINS: "f12.biz,zolotoy-telenok42.ru",
        },
      },
    }),
  },
});
