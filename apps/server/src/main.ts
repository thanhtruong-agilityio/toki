import { buildApp } from "./app.js";
import { ConfigError, loadProcessConfig } from "./config.js";
import { createDb } from "./db/client.js";

// A startup failure is plain text on standard error, one line per variable
// name and never a value; the logger does not exist yet.
let config;
try {
  config = loadProcessConfig(["server", "database", "mail", "auth"]);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  for (const name of error.names)
    console.error(`${name} is missing or invalid`);
  process.exit(1);
}

const connection = createDb(config.database.url);
const app = buildApp({ config, db: connection.db });
app.addHook("onClose", async () => {
  await connection.close();
});

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
