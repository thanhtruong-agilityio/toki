// The only reader of process.env in apps/server/src. One schema per area; a
// later ticket adds its area here. The names come from docs/environment-config.md.
import { z } from "zod";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

const areas = {
  server: z
    .object({
      NODE_ENV: z.enum(["development", "production"]),
      SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      SERVER_HOST: z.string().default("127.0.0.1"),
      LOG_LEVEL: z.enum(logLevels).default("info"),
    })
    .transform((v) => ({
      env: v.NODE_ENV,
      port: v.SERVER_PORT,
      host: v.SERVER_HOST,
      logLevel: v.LOG_LEVEL,
    })),
  database: z
    .object({ DATABASE_URL: z.string().min(1) })
    .transform((v) => ({ url: v.DATABASE_URL })),
};

export type AreaName = keyof typeof areas;
export type Config = { [A in AreaName]: z.output<(typeof areas)[A]> };

// The variable names each area reads, for the check against .env.example.
export const configVariableNames: Record<AreaName, string[]> = {
  server: ["NODE_ENV", "SERVER_PORT", "SERVER_HOST", "LOG_LEVEL"],
  database: ["DATABASE_URL"],
};

// Carries variable names only: a value never reaches the message.
export class ConfigError extends Error {
  constructor(readonly names: string[]) {
    super(`Invalid configuration: ${names.join(", ")}`);
  }
}

type Env = Record<string, string | undefined>;

// An empty or whitespace-only value counts as not set.
function present(env: Env, names: string[]): Env {
  const out: Env = {};
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value.trim() !== "") out[name] = value;
  }
  return out;
}

export function loadConfig<A extends AreaName>(
  env: Env,
  wanted: readonly A[],
): Pick<Config, A> {
  const config: Partial<Config> = {};
  const failing: string[] = [];
  for (const area of wanted) {
    const result = areas[area].safeParse(
      present(env, configVariableNames[area]),
    );
    if (result.success) {
      (config as Record<string, unknown>)[area] = result.data;
    } else {
      for (const issue of result.error.issues) {
        failing.push(String(issue.path[0]));
      }
    }
  }
  if (failing.length > 0) throw new ConfigError([...new Set(failing)]);
  return config as Pick<Config, A>;
}

// For the entry points (the server, later a command-line tool): reads the
// process environment, which this module alone may do.
export function loadProcessConfig<A extends AreaName>(
  wanted: readonly A[],
): Pick<Config, A> {
  return loadConfig(process.env, wanted);
}
