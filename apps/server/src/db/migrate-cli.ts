import { ConfigError, loadProcessConfig } from "../config.js";
import { migrationsFolder, runMigrations } from "./migrate.js";

// pnpm db:migrate. Prints a variable name, the host and database name, or the
// Postgres error text; never the password or the whole URL.
const unreachable = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "CONNECT_TIMEOUT",
  "EHOSTUNREACH",
  "ECONNRESET",
]);

function chain(error: unknown): unknown[] {
  const out: unknown[] = [];
  for (let e = error; e instanceof Error; e = e.cause) out.push(e);
  return out;
}

let url: string;
try {
  url = loadProcessConfig(["database"]).database.url;
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  for (const name of error.names)
    console.error(`${name} is missing or invalid`);
  process.exit(1);
}

try {
  await runMigrations(url, migrationsFolder);
  console.log("Migrations applied.");
} catch (error) {
  const errors = chain(error) as (Error & { code?: string })[];
  if (errors.some((e) => e.code && unreachable.has(e.code))) {
    let place = "the database";
    try {
      const parsed = new URL(url);
      place = `${parsed.host}${parsed.pathname}`;
    } catch {
      // An unparsable value is not printed.
    }
    console.error(`The database cannot be reached at ${place}`);
  } else {
    for (const e of errors) console.error(e.message);
  }
  process.exit(1);
}
