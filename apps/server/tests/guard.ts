// The safety guard of the database tests (TOKI-008 R5). Pure: no I/O, so a
// unit test covers every refusal. It decides on the host and database name the
// URL reaches, never on a string comparison, and it never prints a user or a
// password: the messages carry host and database name only.

export type GuardCheck =
  "set" | "valid" | "loopback" | "suffix" | "development" | "environment";

export class GuardError extends Error {
  constructor(
    readonly check: GuardCheck,
    message: string,
  ) {
    super(`Test database refused (${check}): ${message}`);
  }
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export interface GuardInput {
  /** TEST_DATABASE_URL. */
  testUrl: string | undefined;
  /** DATABASE_URL, when there is one (there is none in CI). */
  developmentUrl?: string | undefined;
  /** Every source of the environment name: the shell, the root .env. */
  environments: readonly (string | undefined)[];
}

function databaseName(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

export function checkTestDatabase(input: GuardInput) {
  if (!input.testUrl?.trim()) {
    throw new GuardError("set", "TEST_DATABASE_URL is not set");
  }
  let url: URL;
  try {
    url = new URL(input.testUrl);
  } catch {
    throw new GuardError("valid", "TEST_DATABASE_URL is not a valid URL");
  }
  const host = url.hostname;
  const database = databaseName(url);
  if (!loopbackHosts.has(host)) {
    throw new GuardError(
      "loopback",
      `host '${host}' is not a loopback address (database '${database}')`,
    );
  }
  if (!database.endsWith("_test")) {
    throw new GuardError(
      "suffix",
      `database '${database}' on ${host} does not end in _test`,
    );
  }
  if (input.developmentUrl?.trim()) {
    let development: URL | undefined;
    try {
      development = new URL(input.developmentUrl);
    } catch {
      // An unreadable development value cannot be compared; the other checks stand.
    }
    if (development && databaseName(development) === database) {
      throw new GuardError(
        "development",
        `database '${database}' on ${host} is the development database`,
      );
    }
  }
  if (input.environments.some((value) => value?.trim() === "production")) {
    throw new GuardError("environment", "the environment name is production");
  }
  return { host, database };
}
