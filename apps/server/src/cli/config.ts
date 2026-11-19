// The configuration of the command `emergency:link` (TOKI-026 R22). It reads only what it needs, from
// its own small schema, and imports nothing from `src/config.ts`, which reaches the mail module. A
// failure carries variable names only; a value never reaches the message.

type Env = Record<string, string | undefined>;

export class CliConfigError extends Error {
  constructor(readonly names: string[]) {
    super(`Invalid configuration: ${names.join(", ")}`);
  }
}

export type CliConfig = {
  databaseUrl: string;
  // The app's own origin: scheme, host and port, no path.
  origin: string;
  // Only an explicit `development` is development; a missing or unknown value is production
  // (TOKI-022 R21).
  production: boolean;
};

const value = (env: Env, name: string): string | undefined => {
  const v = env[name];
  return v === undefined || v.trim() === "" ? undefined : v.trim();
};

function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

export function readCliConfig(env: Env): CliConfig {
  const failing: string[] = [];
  const production = value(env, "NODE_ENV") !== "development";

  const databaseUrl = value(env, "DATABASE_URL");
  if (databaseUrl === undefined || parseUrl(databaseUrl) === null) {
    failing.push("DATABASE_URL");
  }

  const originText = value(env, "APP_ORIGIN");
  const url = originText === undefined ? null : parseUrl(originText);
  const plain =
    url !== null &&
    (url.protocol === "https:" || url.protocol === "http:") &&
    // No path, query, fragment or credentials: the text is the origin, with at most one slash.
    originText!.replace(/\/$/, "") === url.origin;
  // `http://` is accepted only in development (R22).
  const secure = url?.protocol === "https:" || !production;
  if (!plain || !secure) failing.push("APP_ORIGIN");

  if (failing.length > 0) throw new CliConfigError(failing);
  return { databaseUrl: databaseUrl!, origin: url!.origin, production };
}
