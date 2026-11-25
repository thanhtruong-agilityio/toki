import { defineConfig } from "vitest/config";

// The pure helpers of the UI parity check (TOKI-109) live in e2e/support and are tested here. The
// root vitest.config.ts lists this folder as a project, because it only globs apps/* and packages/*.
export default defineConfig({
  test: {
    name: "e2e",
    include: ["support/**/*.test.ts"],
  },
});
