import { defineConfig } from "vitest/config";
import { loadRootEnv } from "./tests/root-env.js";

// The database-free project (R20): every test file except *.db.test.ts, and no
// Postgres needed. `pnpm --filter ./apps/server test:unit` runs only this one.
loadRootEnv();

export default defineConfig({
  test: { name: "server", exclude: ["**/node_modules/**", "**/*.db.test.ts"] },
});
