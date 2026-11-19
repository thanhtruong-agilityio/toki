import { SESSION_IDLE_DAYS, type Transport } from "@toki/shared";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { ErrorCodes } from "@toki/shared";
import { getAccountById, type Account } from "../members/index.js";
import { cookieName, readCookie } from "./cookies.js";
import { runtime } from "./runtime.js";
import { withTransaction } from "./tx.js";
import { newSecret, sha256 } from "./secrets.js";
import { sessions } from "./schema.js";

export type EndReason = "signed_out" | "replaced" | "revoked" | "deactivated";

export class AccountNotActiveError extends Error {
  constructor() {
    super("A session is created only for an Active account.");
  }
}

const IDLE_MS = SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;

// ---- listeners (R50) ----

type Listener = (ids: string[], reason: EndReason) => void;
const listeners = new Set<Listener>();

export function onSessionsEnded(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportSessionsEnded(ids: string[], reason: EndReason): void {
  if (ids.length === 0) return;
  for (const listener of [...listeners]) {
    try {
      listener(ids, reason);
    } catch {
      // A listener that fails must not undo or hide the end of a session.
    }
  }
}

// ---- create (R29, R35) ----

export async function createSession(
  client: DbClient,
  account: Pick<Account, "id" | "workspaceId" | "status">,
  transport: Transport,
  options: { userAgent?: string } = {},
): Promise<{ id: string; secret: string }> {
  if (account.status !== "active") throw new AccountNotActiveError();
  const secret = newSecret();
  const now = new Date(runtime.clock.now());
  const { result } = await withTransaction(client, async (tx) => {
    const [row] = await tx
      .insert(sessions)
      .values({
        workspaceId: account.workspaceId,
        userId: account.id,
        createdAt: now,
        secretHash: sha256(secret),
        kind: transport,
        userAgent: options.userAgent?.slice(0, 512) ?? null,
        lastUsedAt: now,
      })
      .returning({ id: sessions.id });
    return row!.id;
  });
  return { id: result, secret };
}

// ---- end (R28, R30, R34, R50, R52) ----

async function endWhere(
  client: DbClient,
  condition: ReturnType<typeof eq> | undefined,
  reason: EndReason,
): Promise<string[]> {
  const now = new Date(runtime.clock.now());
  const { result, own } = await withTransaction(client, async (tx) => {
    const rows = await tx
      .update(sessions)
      .set({ endedAt: now, endedReason: reason })
      .where(and(condition, isNull(sessions.endedAt)))
      .returning({ id: sessions.id });
    return rows.map((r) => r.id);
  });
  if (own) reportSessionsEnded(result, reason);
  return result;
}

export function endSessionsOfUser(
  client: DbClient,
  userId: string,
  options: {
    reason: "revoked" | "deactivated";
    only?: string[];
    except?: string;
  },
): Promise<string[]> {
  const parts = [eq(sessions.userId, userId)];
  if (options.only) {
    if (options.only.length === 0) return Promise.resolve([]);
    parts.push(inArray(sessions.id, options.only));
  }
  if (options.except) parts.push(ne(sessions.id, options.except));
  return endWhere(client, and(...parts) as never, options.reason);
}

// ---- reading the secret of a request (R44) ----

export type RequestSecret = { secret: string; via: "header" | "cookie" };

type HeaderSource = { headers: Record<string, string | string[] | undefined> };

// The Authorization header wins when the request has one; otherwise the one
// cookie of this environment.
export function secretOfRequest(request: HeaderSource): RequestSecret | null {
  const authorization = request.headers.authorization;
  if (typeof authorization === "string") {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    // A header that is not a usable Bearer value counts as no secret, so a
    // stale cookie is not used behind it either: a header is sent on purpose.
    return match ? { secret: match[1]!, via: "header" } : null;
  }
  const cookie = request.headers.cookie;
  const value = readCookie(
    typeof cookie === "string" ? cookie : undefined,
    cookieName(runtime.development),
  );
  return value ? { secret: value, via: "cookie" } : null;
}

type SessionRow = typeof sessions.$inferSelect;

// The session of a secret, only when it was sent the way it was issued.
async function loadSession(
  client: DbClient,
  found: RequestSecret,
): Promise<SessionRow | null> {
  const [row] = await client
    .select()
    .from(sessions)
    .where(eq(sessions.secretHash, sha256(found.secret)))
    .limit(1);
  if (!row) return null;
  if ((found.via === "header") !== (row.kind === "token")) return null;
  return row;
}

export async function endSessionOfRequest(
  client: DbClient,
  request: HeaderSource,
  reason: "signed_out" | "replaced",
  options: { only?: "cookie" } = {},
): Promise<string | null> {
  const found = secretOfRequest(request);
  if (!found) return null;
  if (options.only === "cookie" && found.via !== "cookie") return null;
  const session = await loadSession(client, found);
  if (!session || session.endedAt) return null;
  const account = await getAccountById(client, session.userId);
  if (!account || account.status !== "active") return null;
  const ids = await endWhere(client, eq(sessions.id, session.id), reason);
  return ids[0] ?? null;
}

// ---- the check (R24 to R27, R44, R55) ----

export type CheckedSession = {
  sessionId: string;
  account: Account;
  via: "header" | "cookie";
  secret: string;
};

// Order: the account before the session (R27), then ended, then idle, then
// renewal by one conditional UPDATE, so an ended session is never renewed.
export async function checkSession(
  client: DbClient,
  request: HeaderSource,
): Promise<CheckedSession> {
  const unauthenticated = () =>
    new AppError(401, ErrorCodes.unauthenticated, "A session is required.");
  const found = secretOfRequest(request);
  if (!found) throw unauthenticated();
  // The session and its account are read in one transaction (plan decision 6).
  const { result: loaded } = await withTransaction(client, async (tx) => {
    const found_ = await loadSession(tx, found);
    if (!found_) return null;
    return {
      session: found_,
      account: await getAccountById(tx, found_.userId),
    };
  });
  if (!loaded || !loaded.account) throw unauthenticated();
  const { session, account } = loaded;
  if (account.status === "deactivated") {
    throw new AppError(
      401,
      ErrorCodes.accountDeactivated,
      "This account has been deactivated.",
    );
  }
  const ended = () =>
    new AppError(401, ErrorCodes.sessionEnded, "The session has ended.");
  if (session.endedAt) throw ended();
  const now = runtime.clock.now();
  if (now - session.lastUsedAt.getTime() > IDLE_MS) throw ended();
  const renewed = await client
    .update(sessions)
    .set({ lastUsedAt: new Date(now) })
    .where(and(eq(sessions.id, session.id), isNull(sessions.endedAt)))
    .returning({ id: sessions.id });
  if (renewed.length === 0) throw ended();
  return {
    sessionId: session.id,
    account,
    via: found.via,
    secret: found.secret,
  };
}
