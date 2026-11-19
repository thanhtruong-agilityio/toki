import { systemClock } from "@toki/shared";
import { buildApp } from "./app.js";
import { ConfigError, loadProcessConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { ensureFirstAdmin } from "./first-admin.js";

// A startup failure is plain text on standard error, one line per variable
// name and never a value; the logger does not exist yet.
let config;
try {
  config = loadProcessConfig(["server", "database", "mail", "firstAdmin"]);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  for (const name of error.names)
    console.error(`${name} is missing or invalid`);
  process.exit(1);
}

const app = buildApp({ config });

// The first set-up (TOKI-020). It starts after the server listens, so an
// unreachable database never delays /healthz. The close hook stops it from
// starting a new attempt, waits for the attempt in progress (bounded at 10
// seconds), and only then closes the connection pool under it.
const { db, close: closeDb } = createDb(config.database.url);
const stopFirstAdmin = new AbortController();
let firstAdmin: Promise<unknown> = Promise.resolve();
app.addHook("onClose", async () => {
  stopFirstAdmin.abort();
  await firstAdmin;
  await closeDb();
});

// The only global timer of this step; unref'd so it never keeps the process up.
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

// One shutdown path: stop accepting requests, run the close hooks the app has
// registered (a later ticket adds its pool, worker or gateway), exit 0.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, "shutdown failed");
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ port: config.server.port, host: config.server.host });
} catch (error) {
  app.log.error({ err: error }, "could not listen");
  process.exit(1);
}

firstAdmin = ensureFirstAdmin({
  db,
  config: config.firstAdmin,
  clock: systemClock,
  logger: app.log,
  sleep,
  signal: stopFirstAdmin.signal,
});
