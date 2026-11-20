// Test-only: starts the real server for the sign-in end-to-end tests (TOKI-023, e2e/sign-in-server).
// Playwright starts a web server before any setup of its own, so the database is made here first: the
// database E2E_DATABASE_NAME on the server of E2E_DATABASE_URL is dropped, created, migrated and seeded
// (the workspace, the first Admin, a deactivated member), then the real `main.ts` starts on it. The
// first-admin step of TOKI-020 finds the Admin and writes nothing. Refuses a host that is not loopback,
// like `createThrowawayDb`. The rows come from the same helper as the database tests (test-rows.ts).
import postgres from "postgres";
import { migrationsFolder, runMigrations } from "../src/db/migrate.js";
import { insertUser, insertWorkspace } from "./test-rows.js";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

function need(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is not set`);
  return value;
}

const serverUrl = need("E2E_DATABASE_URL");
const name = need("E2E_DATABASE_NAME");
if (!/^[a-z0-9_]+_test$/.test(name)) {
  throw new Error(`E2E_DATABASE_NAME '${name}' must match [a-z0-9_]+_test`);
}
const base = new URL(serverUrl);
if (!loopbackHosts.has(base.hostname)) {
  throw new Error(
    `E2E_DATABASE_URL points at '${base.hostname}', which is not a loopback address: refusing to run`,
  );
}

const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
try {
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
} finally {
  await admin.end();
}
const url = new URL(serverUrl);
url.pathname = `/${name}`;
await runMigrations(url.toString(), migrationsFolder);

const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
try {
  const workspace_id = await insertWorkspace(sql, {
    name: need("WORKSPACE_NAME"),
  });
  await insertUser(sql, {
    workspace_id,
    email: need("FIRST_ADMIN_EMAIL"),
    display_name: "Test Admin",
    role: "admin",
  });
  await insertUser(sql, {
    workspace_id,
    email: need("E2E_DEACTIVATED_EMAIL"),
    display_name: "Gone Member",
    status: "deactivated",
  });
} finally {
  await sql.end();
}

process.env.DATABASE_URL = url.toString();
await import("../src/main.js");
