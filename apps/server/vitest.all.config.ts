import { defineConfig } from "vitest/config";

// Both projects of apps/server: the `test` script (R20).
export default defineConfig({
  test: { projects: ["./vitest.config.ts", "./vitest.db.config.ts"] },
});
