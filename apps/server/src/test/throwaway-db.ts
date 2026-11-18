import { randomBytes } from "node:crypto";
import postgres from "postgres";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

// Makes a database of its own on the server of TEST_DATABASE_URL and drops it
// with FORCE when done, so a test never writes to the development database.
// It refuses a host that is not loopback before it sends any statement, and it
// fails, never skips, when the variable is unset or Postgres is unreachable.
export async function createThrowawayDb(
  serverUrl: string | undefined = process.env.TEST_DATABASE_URL,
) {
  if (!serverUrl?.trim()) {
    throw new Error("TEST_DATABASE_URL is not set: the database tests need it");
  }
  const server = new URL(serverUrl);
  if (!loopbackHosts.has(server.hostname)) {
    throw new Error(
      `TEST_DATABASE_URL points at '${server.hostname}', which is not a loopback address: refusing to run`,
    );
  }
  const name = `toki_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    await admin.end();
    throw new Error(
      `TEST_DATABASE_URL: cannot create a database on ${server.host}: ${(error as Error).message}`,
      { cause: error },
    );
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      try {
        await admin.unsafe(`drop database if exists "${name}" with (force)`);
      } finally {
        await admin.end();
      }
    },
  };
}
