import type { Clock } from "@toki/shared";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ADVISORY_KEYS, ADVISORY_NAMESPACE } from "./db/advisory-locks.js";
import { createGeneralChannel } from "./modules/conversations/index.js";
import {
  countAccounts,
  createFirstAdminAccount,
} from "./modules/members/index.js";
import {
  createWorkspace,
  listWorkspaceIds,
} from "./modules/workspace/index.js";

// The first set-up of a new installation (TOKI-020): on an empty database it
// writes the workspace, the first Admin and #general in one transaction; on a
// database that has data it writes nothing. It never throws. It lives outside
// modules/ and reaches each module through its index.ts only, so no module
// imports another for it.

export const MAX_ATTEMPTS = 10;
export const RETRY_DELAY_MS = 15_000;
export const ATTEMPT_TIMEOUT_MS = 10_000;

export type FirstAdminResult = "created" | "skipped" | "failed" | "stopped";

type Tx = PostgresJsDatabase;

// The app logger fits: no line of this step carries a value of the set-up.
export type StepLogger = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
};

export type FirstAdminDeps = {
  db: PostgresJsDatabase;
  config: { email: string; name?: string | undefined; workspaceName: string };
  clock: Clock;
  logger: StepLogger;
  // Waits that many milliseconds; a test passes a fake.
  sleep: (ms: number) => Promise<void>;
  signal: AbortSignal;
};

// Test hooks (Design, "Test hooks"): awaited inside the transaction after the
// step they are named for. The server passes none.
export type FirstAdminHooks = {
  afterCount?: (args: { tx: Tx }) => Promise<void>;
  afterWorkspace?: (args: { tx: Tx; workspaceId: string }) => Promise<void>;
  afterAccount?: (args: {
    tx: Tx;
    workspaceId: string;
    userId: string;
  }) => Promise<void>;
  afterGeneral?: (args: {
    tx: Tx;
    workspaceId: string;
    userId: string;
    conversationId: string;
  }) => Promise<void>;
};

const NODE_RETRY_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
]);
const PG_RETRY_CODES = new Set([
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "55P03",
  "42P01",
]);

type Outcome =
  | { kind: "created"; workspaceId: string; userId: string; conversationId: string; adopted: boolean }
  | { kind: "skipped"; reason: "database_not_empty" }
  | { kind: "several_workspaces" };

type Found = { code: string; constraint: string | undefined };

// The code is read from the error, or from its cause when the error is a
// wrapper (the query layer wraps driver errors). Never the message.
function describe(error: unknown): Found {
  const levels: unknown[] = [error];
  if (typeof error === "object" && error !== null && "cause" in error) {
    levels.push((error as { cause: unknown }).cause);
  }
  let code: string | undefined;
  let constraint: string | undefined;
  for (const level of levels) {
    if (typeof level !== "object" || level === null) continue;
    const e = level as Record<string, unknown>;
    if (code === undefined && typeof e.code === "string") code = e.code;
    if (constraint === undefined) {
      const c = e.constraint_name ?? e.constraint;
      if (typeof c === "string") constraint = c;
    }
  }
  return { code: code ?? "unknown", constraint };
}

function retriable(code: string): boolean {
  return (
    NODE_RETRY_CODES.has(code) ||
    PG_RETRY_CODES.has(code) ||
    code.startsWith("08") ||
    code === "attempt_timeout"
  );
}

async function runAttempt(
  deps: FirstAdminDeps,
  hooks: FirstAdminHooks,
): Promise<Outcome> {
  const { config, clock } = deps;
  return deps.db.transaction(async (tx) => {
    // Both limits are 10 s (R19). The statement limit is set after the lock
    // is taken: the wait for the lock is itself a statement, and with both
    // limits on it the statement limit always fires first (code 57014), so
    // the lock limit (55P03, which R18 retries) could never be the one seen.
    await tx.execute(sql`set local lock_timeout = '10s'`);
    // Released by the commit or the rollback; the second process waits here.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${ADVISORY_NAMESPACE}::int, ${ADVISORY_KEYS.firstAdmin}::int)`,
    );
    await tx.execute(sql`set local statement_timeout = '10s'`);

    const workspaceIds = await listWorkspaceIds(tx);
    const accounts = await countAccounts(tx);
    await hooks.afterCount?.({ tx });
    if (accounts > 0) {
      return { kind: "skipped", reason: "database_not_empty" } as const;
    }
    if (workspaceIds.length > 1) return { kind: "several_workspaces" } as const;

    const createdAt = new Date(clock.now());
    let workspaceId = workspaceIds[0];
    const adopted = workspaceId !== undefined;
    if (workspaceId === undefined) {
      workspaceId = await createWorkspace(tx, { name: config.workspaceName });
    }
    await hooks.afterWorkspace?.({ tx, workspaceId });

    const userId = await createFirstAdminAccount(tx, {
      workspaceId,
      email: config.email,
      displayName: config.name ?? config.email.split("@")[0]!,
      createdAt,
    });
    await hooks.afterAccount?.({ tx, workspaceId, userId });

    const conversationId = await createGeneralChannel(tx, {
      workspaceId,
      createdBy: userId,
      createdAt,
    });
    await hooks.afterGeneral?.({ tx, workspaceId, userId, conversationId });
    return { kind: "created", workspaceId, userId, conversationId, adopted };
  });
}

// One attempt raced against its deadline. The abandoned attempt's late result
// is discarded; its late commit is safe because a retry finds the database
// not empty and skips.
async function boundedAttempt(
  deps: FirstAdminDeps,
  hooks: FirstAdminHooks,
): Promise<Outcome> {
  const attempt = runAttempt(deps, hooks);
  attempt.catch(() => undefined);
  const deadline = deps.sleep(ATTEMPT_TIMEOUT_MS).then(() => {
    throw Object.assign(new Error("attempt timeout"), {
      code: "attempt_timeout",
    });
  });
  deadline.catch(() => undefined);
  return Promise.race([attempt, deadline]);
}

// Waits for the retry delay, or until the signal aborts.
function delay(deps: FirstAdminDeps): Promise<void> {
  return new Promise((resolve) => {
    if (deps.signal.aborted) return resolve();
    const done = () => {
      deps.signal.removeEventListener("abort", done);
      resolve();
    };
    deps.signal.addEventListener("abort", done);
    deps.sleep(RETRY_DELAY_MS).then(done, done);
  });
}

export async function ensureFirstAdmin(
  deps: FirstAdminDeps,
  hooks: FirstAdminHooks = {},
): Promise<FirstAdminResult> {
  const { logger } = deps;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (deps.signal.aborted) {
      logger.info({ attempt }, "first_admin_stopped");
      return "stopped";
    }
    try {
      const outcome = await boundedAttempt(deps, hooks);
      switch (outcome.kind) {
        case "created":
          logger.info(
            {
              workspaceId: outcome.workspaceId,
              userId: outcome.userId,
              conversationId: outcome.conversationId,
              adopted: outcome.adopted,
            },
            "first_admin_created",
          );
          return "created";
        case "skipped":
          logger.info({ reason: outcome.reason }, "first_admin_skipped");
          return "skipped";
        case "several_workspaces":
          logger.warn(
            { reason: "several_workspaces" },
            "first_admin_workspace_without_account",
          );
          return "skipped";
      }
    } catch (error) {
      const { code, constraint } = describe(error);
      const retry = retriable(code) && attempt < MAX_ATTEMPTS;
      logger.error(
        {
          code,
          ...(constraint !== undefined ? { constraint } : {}),
          attempt,
          retry,
        },
        "first_admin_failed",
      );
      if (!retry) return "failed";
      await delay(deps);
    }
  }
  return "failed";
}
