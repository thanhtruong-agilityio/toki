// The command `emergency:link <email>` (TOKI-026 R18 to R23, R35, R36): prints a one-time sign-in link
// for one member, valid 10 minutes, for an operator with shell access when mail is down.
//
// Output contract (R19): the link alone on standard output; everything else, the log line included, on
// standard error. Exit codes: 0 a link was printed; 1 a refusal, a bad configuration or a failure; 2 a
// wrong call. It imports no mail code (R23): `config.ts` here, the narrow `auth/cli.ts`, and the entry
// of the `members` module, never the whole configuration or the index of `auth`.
import { parseEmail, systemClock } from "@toki/shared";
import pino from "pino";
import { createDb } from "../db/client.js";
import { issueEmergencyLink } from "../modules/auth/cli.js";
import { findAccountForEmergencyLink } from "../modules/members/cli.js";
import { CliConfigError, readCliConfig } from "./config.js";
import { operatorName } from "./operator.js";

// The logger of the server with standard error as its destination, written at once so a line is not
// lost when the process ends.
const logger = pino(
  { base: null, level: "info" },
  pino.destination({ dest: 2, sync: true }),
);
const operator = operatorName();

async function main(args: string[]): Promise<number> {
  if (args.length !== 1) {
    process.stderr.write("usage: emergency:link <email>\n");
    return 2;
  }
  const email = parseEmail(args[0]!);
  if (email === null) {
    process.stderr.write("usage: emergency:link <email> (not an address)\n");
    return 2;
  }

  let config;
  try {
    config = readCliConfig(process.env);
  } catch (error) {
    if (error instanceof CliConfigError) {
      // Names only, never a value.
      process.stderr.write(
        `${error.names.map((n) => `${n} is missing or invalid`).join("\n")}\n`,
      );
      return 1;
    }
    throw error;
  }

  const { db, close } = createDb(config.databaseUrl);
  try {
    const account = await findAccountForEmergencyLink(db, email);
    if (!account) {
      logger.warn({ operator, reason: "no_account" }, "emergency_link_refused");
      return 1;
    }
    if (account.status !== "active") {
      logger.warn(
        { operator, reason: "deactivated", userId: account.id },
        "emergency_link_refused",
      );
      return 1;
    }
    // The row is written before anything is printed, so a printed link always exists in the table.
    const issued = await issueEmergencyLink(
      db,
      account,
      new Date(systemClock.now()),
    );
    if (issued === "concurrent") {
      logger.warn(
        { operator, reason: "concurrent_issue", userId: account.id },
        "emergency_link_refused",
      );
      return 1;
    }
    process.stdout.write(`${config.origin}/emergency#${issued.token}\n`);
    logger.info(
      {
        operator,
        userId: account.id,
        linkId: issued.linkId,
        expiresAt: issued.expiresAt.toISOString(),
      },
      "emergency_link_issued",
    );
    return 0;
  } finally {
    await close();
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // The message of a failed query carries its parameters, the hash of the token among them: only the
    // kind of error is written (R36).
    const kind = error instanceof Error ? error.name : "error";
    process.stderr.write(`emergency:link failed (${kind})\n`);
    process.exitCode = 1;
  },
);
