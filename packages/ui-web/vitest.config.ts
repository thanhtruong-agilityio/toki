import { defineConfig } from "vitest/config";

// jsdom for every file; `globals` stays off, so src/test/setup.ts registers
// the matchers, the cleanup and the act flag itself (R27).
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
