import { defineConfig } from "vitest/config";

// One project per workspace folder, found by glob, so a first test in a new
// package is picked up with no change here (R12). The tests of apps/server
// that need Postgres are a second project of that folder (R20).
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*", "apps/server/vitest.db.config.ts"],
  },
});
