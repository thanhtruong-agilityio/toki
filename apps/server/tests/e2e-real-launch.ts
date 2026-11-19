// Test-only: starts the real server for the end-to-end tests that need a database (TOKI-026, e2e/real-server).
// Playwright starts a web server before any setup of its own, so the database is made here first: the
// fixed database `toki_e2e_real` on the server of TEST_DATABASE_URL is dropped, created and migrated,
// then the real `main.ts` starts on it. The first-admin step of TOKI-020 fills the empty database.
// Refuses a host that is not loopback, like `createThrowawayDb`.
import postgres from "postgres";
import { migrationsFolder, runMigrations } from "../src/db/migrate.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const NAME = "toki_e2e_real";

const serverUrl = process.env.TEST_DATABASE_URL;
if (!serverUrl?.trim()) {
  throw new Error("TEST_DATABASE_URL is not set: the real-server e2e needs it");
}
const base = new URL(serverUrl);
if (!loopbackHosts.has(base.hostname)) {
  throw new Error(
    `TEST_DATABASE_URL points at '${base.hostname}', which is not a loopback address: refusing to run`,
  );
}

const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
try {
  await admin.unsafe(`drop database if exists "${NAME}" with (force)`);
  await admin.unsafe(`create database "${NAME}"`);
} finally {
  await admin.end();
}
const url = new URL(serverUrl);
url.pathname = `/${NAME}`;
await runMigrations(url.toString(), migrationsFolder);

process.env.DATABASE_URL = url.toString();
await import("../src/main.js");
