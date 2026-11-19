// Using an emergency link (TOKI-026 R26 to R33). Issuing one, which the command needs without the mail
// layer, is in `emergency-issue.ts` and re-exported here for the routes and the tests.
import type { Transport } from "@toki/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { getAccountById, type Account } from "../members/index.js";
import { runtime } from "./runtime.js";
import { emergencyLinks } from "./schema.js";
import {
  createSession,
  endSessionOfRequest,
  type EndReason,
} from "./sessions.js";

export {
  hashLinkToken,
  issueEmergencyLink,
  type IssuedLink,
} from "./emergency-issue.js";
import { hashLinkToken } from "./emergency-issue.js";

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
