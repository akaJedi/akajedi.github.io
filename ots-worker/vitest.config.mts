import { cloudflarePool } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["ots-worker/tests/**/*.test.ts"],
    pool: cloudflarePool({
      main: "./ots-worker/src/index.ts",
      miniflare: {
        compatibilityDate: "2026-06-01",
        d1Databases: ["DB"],
        bindings: {
          ENVIRONMENT: "test",
          OWNER_CREATION_ENABLED: "false",
          PUBLIC_TRIAL_ENABLED: "false",
        },
      },
    }),
  },
});
