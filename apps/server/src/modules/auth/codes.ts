import {
  CODE_MAX_WRONG_TRIES,
  CODE_REQUESTS_MAX,
  CODE_REQUESTS_WINDOW_SECONDS,
  CODE_RESEND_SECONDS,
  CODE_TTL_SECONDS,
  ErrorCodes,
  type Transport,
} from "@toki/shared";
import { and, asc, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import type { Db, DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { findAccountByEmail, getAccountById } from "../members/index.js";
import { getWorkspace } from "../workspace/index.js";
import { runtime } from "./runtime.js";
import { loginCodes } from "./schema.js";
import { hashCode, newCode, newSecret, sha256 } from "./secrets.js";
import { withTransaction } from "./tx.js";
import {
  createSession,
  endSessionOfRequest,
  reportSessionsEnded,
} from "./sessions.js";

const WINDOW_MS = CODE_REQUESTS_WINDOW_SECONDS * 1000;
const RESEND_MS = CODE_RESEND_SECONDS * 1000;
const PRUNE_BATCH = 100;

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

export type RequestedCode = {
  requestId: string;
  // Handed to the mail layer after the answer; never returned to the client.
  mail: { to: string; code: string; language: "en" | "vi" } | null;
};

// R1 to R9, R40 to R42, R47, R48. The same statements run for every address
// (R41): the code is drawn and hashed also when no mail will follow.
export async function requestCode(
  db: Db,
  secret: string,
  email: string,
): Promise<RequestedCode> {
  const now = runtime.clock.now();
  const nowDate = new Date(now);
  return db.transaction(async (tx) => {
    // One request per address at a time, so two cannot both pass the limits.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

    const windowStart = new Date(now - WINDOW_MS);
    const counted = await tx
      .select({ createdAt: loginCodes.createdAt })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.purpose, "sign_in"),
          eq(loginCodes.email, email),
          gt(loginCodes.createdAt, windowStart),
        ),
      )
      .orderBy(asc(loginCodes.createdAt));
    const last = counted.at(-1)?.createdAt.getTime();
    const waits: number[] = [];
    let limited = false;
    if (counted.length >= CODE_REQUESTS_MAX) {
      limited = true;
      waits.push(counted[0]!.createdAt.getTime() + WINDOW_MS - now);
    }
    if (last !== undefined && now - last < RESEND_MS) {
      waits.push(last + RESEND_MS - now);
    }
    if (waits.length > 0) {
      throw new AppError(
        429,
        limited ? ErrorCodes.codeRequestLimit : ErrorCodes.codeResendTooSoon,
        limited
          ? "Too many code requests for this address."
          : "A new code was requested too recently.",
        { retryAfterSeconds: seconds(Math.max(...waits)) },
      );
    }

    await tx
      .update(loginCodes)
      .set({ cancelledAt: nowDate })
      .where(
        and(
          eq(loginCodes.purpose, "sign_in"),
          eq(loginCodes.email, email),
          isNull(loginCodes.usedAt),
          isNull(loginCodes.cancelledAt),
        ),
      );

    // R48: up to 100 sign-in rows, of any address, that count for no limit.
    const stale = tx
      .select({ id: loginCodes.id })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.purpose, "sign_in"),
          lte(loginCodes.createdAt, windowStart),
        ),
      )
      .limit(PRUNE_BATCH);
    await tx.delete(loginCodes).where(inArray(loginCodes.id, stale));

    const account = await findAccountByEmail(tx, email);
    const workspace = await getWorkspace(tx);
    if (!workspace) throw new Error("There is no workspace.");
    const code = newCode();
    const requestId = newSecret();
    await tx.insert(loginCodes).values({
      workspaceId: workspace.id,
      createdAt: nowDate,
      purpose: "sign_in",
      email,
      userId: account?.id ?? null,
      requestHash: sha256(requestId),
      codeHash: hashCode(secret, requestId, code),
      expiresAt: new Date(now + CODE_TTL_SECONDS * 1000),
    });
    return {
      requestId,
      mail: account ? { to: email, code, language: account.language } : null,
    };
  });
}

// ---- exchange (R10 to R20, R43) ----

type CodeRow = typeof loginCodes.$inferSelect;

const expired = () =>
  new AppError(400, ErrorCodes.codeExpired, "The code has expired.");
const locked = () =>
  new AppError(400, ErrorCodes.codeLocked, "The code is locked.");
const incorrect = (triesLeft: number) =>
  new AppError(400, ErrorCodes.codeIncorrect, "The code is incorrect.", {
    triesLeft,
  });

// The order of the checks: unknown, used or cancelled -> expired; five wrong
// tries -> locked; at or past expiry -> expired.
function refusal(row: CodeRow | undefined, now: number): AppError | null {
  if (!row || row.usedAt || row.cancelledAt) return expired();
  if (row.wrongTries >= CODE_MAX_WRONG_TRIES) return locked();
  if (now >= row.expiresAt.getTime()) return expired();
  return null;
}

function matches(expectedHex: string, actualHex: string): boolean {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(actualHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Exchanged = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "member" | "admin";
    language: "en" | "vi";
  };
  session: { id: string; secret: string };
  replaced: string | null;
};

export async function exchangeCode(
  db: Db,
  secret: string,
  input: {
    requestId: string;
    code: string;
    transport: Transport;
    userAgent?: string;
    request: { headers: Record<string, string | string[] | undefined> };
  },
): Promise<Exchanged> {
  const requestHash = sha256(input.requestId);
  const load = async () =>
    (
      await db
        .select()
        .from(loginCodes)
        .where(
          and(
            eq(loginCodes.requestHash, requestHash),
            eq(loginCodes.purpose, "sign_in"),
          ),
        )
        .limit(1)
    )[0];

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = runtime.clock.now();
    const row = await load();
    const refused = refusal(row, now);
    if (refused) throw refused;
    const code = row!;

    const right =
      code.userId !== null &&
      matches(code.codeHash, hashCode(secret, input.requestId, input.code));

    if (!right) {
      // One conditional UPDATE decides: the condition carries every rule, so
      // concurrent tries never give more than five (R17).
      const updated = await db
        .update(loginCodes)
        .set({ wrongTries: sql`${loginCodes.wrongTries} + 1` })
        .where(
          and(
            eq(loginCodes.id, code.id),
            isNull(loginCodes.usedAt),
            isNull(loginCodes.cancelledAt),
            gt(loginCodes.expiresAt, new Date(now)),
            sql`${loginCodes.wrongTries} < ${CODE_MAX_WRONG_TRIES}`,
          ),
        )
        .returning({ wrongTries: loginCodes.wrongTries });
      if (updated.length === 0) continue; // the row changed under us: decide again
      const tries = updated[0]!.wrongTries;
      throw tries >= CODE_MAX_WRONG_TRIES
        ? locked()
        : incorrect(CODE_MAX_WRONG_TRIES - tries);
    }

    // Marking the code used and creating the session are one transaction
    // (R43). A deactivated account uses the code up and writes nothing else.
    const outcome = await db.transaction(async (tx) => {
      const used = await tx
        .update(loginCodes)
        .set({ usedAt: new Date(now) })
        .where(
          and(
            eq(loginCodes.id, code.id),
            isNull(loginCodes.usedAt),
            isNull(loginCodes.cancelledAt),
            gt(loginCodes.expiresAt, new Date(now)),
            sql`${loginCodes.wrongTries} < ${CODE_MAX_WRONG_TRIES}`,
          ),
        )
        .returning({ id: loginCodes.id });
      if (used.length === 0) return { kind: "lost" as const };
      const account = await getAccountById(tx, code.userId!);
      if (!account || account.status !== "active") {
        return { kind: "deactivated" as const };
      }
      // Only a cookie sign-in replaces the browser's session (R34).
      const replaced =
        input.transport === "cookie"
          ? await endSessionOfRequest(tx, input.request, "replaced", {
              only: "cookie",
            })
          : null;
      const session = await createSession(tx, account, input.transport, {
        userAgent: input.userAgent,
      });
      return { kind: "ok" as const, account, session, replaced };
    });

    if (outcome.kind === "lost") continue;
    if (outcome.kind === "deactivated") {
      throw new AppError(
        400,
        ErrorCodes.accountDeactivated,
        "This account has been deactivated.",
      );
    }
    if (outcome.replaced) reportSessionsEnded([outcome.replaced], "replaced");
    const a = outcome.account;
    return {
      user: {
        id: a.id,
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        language: a.language,
      },
      session: outcome.session,
      replaced: outcome.replaced,
    };
  }
  throw expired();
}

// ---- invitation codes (R49, R51) ----

// The code hash is keyed with a secret that registerAuthHooks sets; before
// that, a call would hash with an empty key.
function requireRegistered() {
  if (runtime.codeSecret === "") {
    throw new Error("The auth module is not registered on an app yet.");
  }
}

// The code of an invitation: created inside the caller's transaction, so a
// rolled-back invitation leaves no live code. The caller supplies a new secret
// for every code, a resend included (`request_hash` is unique). It sends no
// mail and applies no request limit (concern 4).
export async function createInvitationCode(
  client: DbClient,
  input: { email: string; secret: string },
): Promise<string> {
  requireRegistered();
  const now = new Date(runtime.clock.now());
  const code = newCode();
  const { result } = await withTransaction(client, async (tx) => {
    await tx
      .update(loginCodes)
      .set({ cancelledAt: now })
      .where(
        and(
          eq(loginCodes.purpose, "invitation"),
          eq(loginCodes.email, input.email),
          isNull(loginCodes.usedAt),
          isNull(loginCodes.cancelledAt),
        ),
      );
    const workspace = await getWorkspace(tx);
    if (!workspace) throw new Error("There is no workspace.");
    await tx.insert(loginCodes).values({
      workspaceId: workspace.id,
      createdAt: now,
      purpose: "invitation",
      email: input.email,
      userId: null,
      requestHash: sha256(input.secret),
      codeHash: hashCode(runtime.codeSecret, input.secret, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000),
    });
    return code;
  });
  return result;
}

export type InvitationCheck =
  | { result: "ok" }
  | { result: "incorrect"; triesLeft: number }
  | { result: "locked" }
  | { result: "expired" };

// The same rules as a sign-in code: 10 minutes, once, five wrong tries and the
// lock (R14, R15, R12, R13, R17). It knows no account status.
export async function checkInvitationCode(
  client: DbClient,
  input: { secret: string; code: string },
): Promise<InvitationCheck> {
  requireRegistered();
  const requestHash = sha256(input.secret);
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = runtime.clock.now();
    const [row] = await client
      .select()
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.requestHash, requestHash),
          eq(loginCodes.purpose, "invitation"),
        ),
      )
      .limit(1);
    const refused = refusal(row, now);
    if (refused) {
      return {
        result: refused.code === ErrorCodes.codeLocked ? "locked" : "expired",
      };
    }
    const code = row!;
    const live = and(
      eq(loginCodes.id, code.id),
      isNull(loginCodes.usedAt),
      isNull(loginCodes.cancelledAt),
      gt(loginCodes.expiresAt, new Date(now)),
      sql`${loginCodes.wrongTries} < ${CODE_MAX_WRONG_TRIES}`,
    );
    if (
      matches(
        code.codeHash,
        hashCode(runtime.codeSecret, input.secret, input.code),
      )
    ) {
      const used = await client
        .update(loginCodes)
        .set({ usedAt: new Date(now) })
        .where(live)
        .returning({ id: loginCodes.id });
      if (used.length === 1) return { result: "ok" };
      continue;
    }
    const updated = await client
      .update(loginCodes)
      .set({ wrongTries: sql`${loginCodes.wrongTries} + 1` })
      .where(live)
      .returning({ wrongTries: loginCodes.wrongTries });
    if (updated.length === 0) continue;
    const tries = updated[0]!.wrongTries;
    return tries >= CODE_MAX_WRONG_TRIES
      ? { result: "locked" }
      : { result: "incorrect", triesLeft: CODE_MAX_WRONG_TRIES - tries };
  }
  return { result: "expired" };
}

// Deletes up to `limit` invitation rows created before `olderThan`; never a
// sign-in row (R51).
export async function pruneInvitationCodes(
  client: DbClient,
  olderThan: Date,
  limit: number,
): Promise<number> {
  const { result } = await withTransaction(client, async (tx) => {
    const stale = tx
      .select({ id: loginCodes.id })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.purpose, "invitation"),
          lt(loginCodes.createdAt, olderThan),
        ),
      )
      .limit(limit);
    const deleted = await tx
      .delete(loginCodes)
      .where(inArray(loginCodes.id, stale))
      .returning({ id: loginCodes.id });
    return deleted.length;
  });
  return result;
}
