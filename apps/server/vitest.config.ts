import { defineConfig } from "vitest/config";

// Tests read DATABASE_URL and TEST_DATABASE_URL from the root .env when it is
// there; a value already in the environment (CI) is kept.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No .env: the values must come from the environment.
}

export default defineConfig({});
