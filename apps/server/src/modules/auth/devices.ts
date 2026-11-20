// The list of a person's own sessions and the two ways to end other sessions
// (TOKI-026 R1 to R15). Ending goes through the one ending function of this
// module, so the listeners of TOKI-022 R50 hear about every ended session.
import { ErrorCodes, type SessionItem } from "@toki/shared";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { deviceLabel } from "./device-label.js";
import { runtime } from "./runtime.js";
import { sessions } from "./schema.js";
import { endSessionsOfUser, IDLE_MS } from "./sessions.js";

// Any UUID text: Postgres reads them all, so the check does not look at the
// version bits (R9).
export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Live: not ended and used at most 30 days ago, up to and including exactly 30 days (R2, TOKI-022
// R25). The one expression of the rule, for the `where` of a list and the `select` of one row.
function liveRule(now: number) {
  return and(
    isNull(sessions.endedAt),
    gte(sessions.lastUsedAt, new Date(now - IDLE_MS)),
  );
}

function liveOf(userId: string, now: number) {
  return and(eq(sessions.userId, userId), liveRule(now));
}

async function loadLive(db: Db, userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      lastUsedAt: sessions.lastUsedAt,
    })
    .from(sessions)
    .where(liveOf(userId, runtime.clock.now()))
    .orderBy(desc(sessions.lastUsedAt), asc(sessions.id));
}

export async function listLiveSessions(
  db: Db,
  userId: string,
  currentSessionId: string,
): Promise<SessionItem[]> {
  const rows = await loadLive(db, userId);
  return rows.map((row) => ({
    id: row.id,
    current: row.id === currentSessionId,
    ...deviceLabel(row.userAgent),
    lastUsedAt: row.lastUsedAt.toISOString(),
  }));
}

// R7, R10, R11, R12. The caller has checked that `targetId` is a UUID.
export async function endOneSession(
  db: Db,
  userId: string,
  currentSessionId: string,
  targetId: string,
): Promise<void> {
  if (targetId.toLowerCase() === currentSessionId) {
    throw new AppError(
      400,
      ErrorCodes.currentSession,
      "The session in use is ended by signing out.",
    );
  }
  // One read of the person's own row: another person's session and an unknown id give the one
  // answer (R10). `ended_at` and the last use say whether it is still live.
  const [row] = await db
    .select({
      id: sessions.id,
      live: sql<boolean>`coalesce(${liveRule(runtime.clock.now())}, false)`,
    })
    .from(sessions)
    .where(and(eq(sessions.id, targetId), eq(sessions.userId, userId)));
  if (!row) throw new AppError(404, ErrorCodes.notFound, "No such session.");
  // An ended session, or one that ran out of time, is already gone: no change and no call to the
  // listeners (R12).
  if (!row.live) return;
  await endSessionsOfUser(db, userId, { reason: "revoked", only: [row.id] });
}

// R13. `only` is the live sessions but the one of the request, never `except`:
// a row that ran out of time has no `ended_at` and is left as it was.
export async function endOtherSessions(
  db: Db,
  userId: string,
  currentSessionId: string,
): Promise<void> {
  const live = await loadLive(db, userId);
  const others = live.map((s) => s.id).filter((id) => id !== currentSessionId);
  if (others.length === 0) return;
  await endSessionsOfUser(db, userId, { reason: "revoked", only: others });
}
