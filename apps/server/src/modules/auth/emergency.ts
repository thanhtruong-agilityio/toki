// The emergency link: issuing it (the command, TOKI-026 R19 to R25, R48) and turning it into a session
// (the route, R26 to R33). Only the hash of the token is stored. This file imports no mail code: the
// command reaches it through `cli.ts` (R23).
import type { Transport } from "@toki/shared";
import { EMERGENCY_LINK_TTL_SECONDS } from "@toki/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { getAccountById, type Account } from "../members/index.js";
import { runtime } from "./runtime.js";
import { emergencyLinks } from "./schema.js";
import { newSecret, sha256 } from "./secrets.js";
import {
  createSession,
  endSessionOfRequest,
  type EndReason,
} from "./sessions.js";

// The hash is taken over the 43 characters exactly as printed, not over the 32 decoded bytes, so a
// link is found only by the string that was printed (R25, R29).
export function hashLinkToken(token: string): string {
  return sha256(token);
}

// A unique violation of the index that holds R48, as Drizzle reports it: the driver error is in
// `cause`, as `first-admin.ts` reads it.
function isConcurrentIssue(error: unknown): boolean {
  const e = ((error as { cause?: unknown })?.cause ?? error) as {
    code?: string;
    constraint_name?: string;
  };
  return (
    e?.code === "23505" &&
    e.constraint_name === "emergency_links_user_id_open_key"
  );
}

export type IssuedLink = { token: string; linkId: string; expiresAt: Date };

// Prints nothing and logs nothing: it cancels the member's earlier open link and stores a new one in one
// transaction (R48). `Db`, not `DbClient`: it always opens its own transaction, and the failed insert of
// a second run is caught around it, because Postgres aborts the transaction after the failure.
export async function issueEmergencyLink(
  db: Db,
  account: Pick<Account, "id" | "workspaceId">,
  now: Date,
): Promise<IssuedLink | "concurrent"> {
  const token = newSecret();
  const expiresAt = new Date(now.getTime() + EMERGENCY_LINK_TTL_SECONDS * 1000);
  try {
    const linkId = await db.transaction(async (tx) => {
      await tx
        .update(emergencyLinks)
        .set({ cancelledAt: now })
        .where(
          and(
            eq(emergencyLinks.userId, account.id),
            isNull(emergencyLinks.usedAt),
            isNull(emergencyLinks.cancelledAt),
          ),
        );
      const [row] = await tx
        .insert(emergencyLinks)
        .values({
          workspaceId: account.workspaceId,
          userId: account.id,
          tokenHash: hashLinkToken(token),
          createdAt: now,
          expiresAt,
        })
        .returning({ id: emergencyLinks.id });
      return row!.id;
    });
    return { token, linkId, expiresAt };
  } catch (error) {
    if (isConcurrentIssue(error)) return "concurrent";
    throw error;
  }
}

export type UsedLink =
  | {
      kind: "ok";
      account: Account;
      session: { id: string; secret: string };
      linkId: string;
      replaced: string | null;
    }
  | { kind: "invalid" }
  | { kind: "deactivated"; userId: string; linkId: string };

// R26 to R33. One transaction: the one `UPDATE` marks the link used only while it is unused, not
// cancelled and before `expires_at`, so two requests cannot both win (R30) and the four ways a link can
// be refused are one answer with no second read (R28). A deactivated account uses the link up and gets
// no session (R31); that is a result, not a throw, so the transaction commits with `used_at` set.
export async function useEmergencyLink(
  db: Db,
  input: {
    token: string;
    transport: Transport;
    userAgent: string | undefined;
    request: { headers: Record<string, string | string[] | undefined> };
  },
): Promise<UsedLink> {
  const now = new Date(runtime.clock.now());
  const outcome = await db.transaction(async (tx) => {
    const used = await tx
      .update(emergencyLinks)
      .set({ usedAt: now })
      .where(
        and(
          eq(emergencyLinks.tokenHash, hashLinkToken(input.token)),
          isNull(emergencyLinks.usedAt),
          isNull(emergencyLinks.cancelledAt),
          gt(emergencyLinks.expiresAt, now),
        ),
      )
      .returning({ id: emergencyLinks.id, userId: emergencyLinks.userId });
    const link = used[0];
    if (!link) return { kind: "invalid" as const };
    const account = await getAccountById(tx, link.userId);
    if (!account || account.status !== "active") {
      return {
        kind: "deactivated" as const,
        userId: link.userId,
        linkId: link.id,
      };
    }
    const session = await createSession(tx, account, input.transport, {
      userAgent: input.userAgent,
    });
    await tx
      .update(emergencyLinks)
      .set({ sessionId: session.id })
      .where(eq(emergencyLinks.id, link.id));
    return { kind: "ok" as const, account, session, linkId: link.id };
  });
  if (outcome.kind !== "ok") return outcome;
  // After the commit, and only for the cookie transport (R33). Given `db`, the function reports the
  // ended id to the listeners itself.
  const replaced =
    input.transport === "cookie"
      ? await endSessionOfRequest(
          db,
          input.request,
          "replaced" satisfies EndReason,
          {
            only: "cookie",
          },
        )
      : null;
  return { ...outcome, replaced };
}
