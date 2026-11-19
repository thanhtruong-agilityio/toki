import { defineConfig } from "vitest/config";
import { loadRootEnv } from "./test/root-env.js";

// The database project (R20): *.db.test.ts only, one file at a time so the
// files can share the one test database (R6). The application's connection
// variable is the test connection in this process (R18); the guard and the
// database itself are handled in the global setup, which fails the tests
// instead of stopping the run, so the database-free tests still run (R7).
loadRootEnv();

export default defineConfig({
  test: {
    name: "server-db",
    include: ["{src,test,tests}/**/*.db.test.ts"],
    fileParallelism: false,
    globalSetup: ["./test/global-setup-db.ts"],
    setupFiles: ["./test/setup-file-db.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
