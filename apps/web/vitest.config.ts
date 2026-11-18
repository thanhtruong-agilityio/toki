import { defineConfig } from "vitest/config";

// Node tests of the web app. This file keeps the project from loading
// vite.config.ts, which reads the repository's .env (TOKI-016 plan, decision 7).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
