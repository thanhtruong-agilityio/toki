import { defineConfig } from "vitest/config";

// jsdom for every file; `globals` stays off, so tests/support/setup.ts registers
// the matchers, the cleanup and the act flag itself (R27).
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/support/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
