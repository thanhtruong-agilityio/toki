// Issuing an emergency link (TOKI-026 R19 to R25, R48), apart from using one so that the command reaches
// it without reaching the mail layer: this file imports no module, only the schema, the secrets and the
// shared limits (R23).
import { EMERGENCY_LINK_TTL_SECONDS } from "@toki/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { emergencyLinks } from "./schema.js";
import { newSecret, sha256 } from "./secrets.js";

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
  account: { id: string; workspaceId: string },
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
