import { defineConfig } from "vitest/config";

// Node by default: the tests of the preview page need it (TOKI-016). A test that
// renders React opts into jsdom with `// @vitest-environment jsdom` on its first
// line (TOKI-093 R2). `globals` stays off, so src/test/setup.ts registers the
// matchers, the cleanup and the act flag itself. This file keeps the project from
// loading vite.config.ts, which reads the repository's .env (TOKI-016 plan,
// decision 7).
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
