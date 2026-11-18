// By hand, for R23 of TOKI-021: sends one mail of each kind through the real
// layer to the SMTP account of `.env` (in development, Mailpit; read them at
// http://127.0.0.1:8025). Not part of `pnpm test`: it needs the services up.
//   pnpm dev:up
//   pnpm --filter @toki/server mail:smoke
import { ConfigError, loadProcessConfig } from "../config.js";
import { createMailLayer } from "../modules/mail/index.js";

let config;
try {
  config = loadProcessConfig(["server", "mail"]);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  for (const name of error.names)
    console.error(`${name} is missing or invalid`);
  process.exit(1);
}

const logger = {
  info: (obj: object) => console.log(JSON.stringify(obj)),
  warn: (obj: object) => console.log(JSON.stringify(obj)),
};
const { layer, close } = createMailLayer({
  config: config.mail,
  logger,
  production: config.server.env === "production",
});

const to = "test.person@example.com";
const results = [
  await layer.sendSignInMail({ to, code: "123456", language: "en" }),
  await layer.sendSignInMail({ to, code: "654321", language: "vi" }),
  await layer.sendInvitationMail({
    to,
    code: "246810",
    workspaceName: "Toki Dev",
    inviterName: "Test Admin",
    joinUrl: "http://localhost:5173/join#example-token-not-real",
  }),
  await layer.sendInvitationCode({ to, code: "135790" }),
];
console.log(JSON.stringify(results));
await close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
