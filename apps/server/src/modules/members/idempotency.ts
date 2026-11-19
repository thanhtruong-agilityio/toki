import { createHash, randomUUID } from "node:crypto";
import { ErrorCodes } from "@toki/shared";
import { and, eq, inArray, lt, ne } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import { memberRequests } from "./schema.js";

// The repeat rule of the batch and the resend (R13, D-111): for each person
// and key the server keeps the hash of the request, a claim and, once the
// request ended with a 200, its response.

// A request that has been running this long is counted as dead and its key
// can be taken over. Longer than the longest live batch, which the mail layer
// bounds at about 60 seconds.
const DEAD_AFTER_MS = 5 * 60 * 1000;
const KEEP_MS = 24 * 60 * 60 * 1000;
const PRUNE_LIMIT = 100;

export type RequestAction = "invite" | "resend";

// The hash of a request: the route, its parameter and the body after the
// schema has parsed it.
export function requestHash(
  action: RequestAction,
  invitationId: string | null,
  body: unknown,
): string {
  return createHash("sha256")
    .update(JSON.stringify([action, invitationId, body]))
    .digest("hex");
}

export type Claim =
  | { kind: "run"; claimId: string }
  | { kind: "replay"; status: number; body: unknown };

type ClaimInput = {
  workspaceId: string;
  userId: string;
  key: string;
  action: RequestAction;
  hash: string;
  now: Date;
};

// Claims the key for this request, or says how an earlier one answers it.
export async function claimRequest(db: Db, input: ClaimInput): Promise<Claim> {
  // A second try only when the row that was in the way was deleted between
  // the insert and the read (its request had failed).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const claim = await db.transaction(async (tx): Promise<Claim | null> => {
      const claimId = randomUUID();
      const inserted = await tx
        .insert(memberRequests)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          requestKey: input.key,
          action: input.action,
          requestHash: input.hash,
          state: "pending",
          claimId,
          createdAt: input.now,
          claimedAt: input.now,
        })
        .onConflictDoNothing()
        .returning({ id: memberRequests.id });
      if (inserted.length > 0) return { kind: "run", claimId };

      const [row] = await tx
        .select()
        .from(memberRequests)
        .where(
          and(
            eq(memberRequests.userId, input.userId),
            eq(memberRequests.requestKey, input.key),
          ),
        )
        .for("no key update");
      if (!row) return null;
      if (row.requestHash !== input.hash) {
        throw new AppError(
          409,
          ErrorCodes.idempotencyKeyReused,
          "This key was used for another request.",
        );
      }
      if (row.state === "done") {
        return {
          kind: "replay",
          status: row.responseStatus!,
          body: row.responseBody,
        };
      }
      if (input.now.getTime() - row.claimedAt.getTime() < DEAD_AFTER_MS) {
        throw new AppError(
          409,
          ErrorCodes.requestInProgress,
          "The same request is still running.",
        );
      }
      // Takeover: the earlier request is counted as dead. Its claim id is
      // replaced, so it can store nothing if it finishes after all.
      await tx
        .update(memberRequests)
        .set({ claimId, claimedAt: input.now })
        .where(eq(memberRequests.id, row.id));
      return { kind: "run", claimId };
    });
    if (claim) return claim;
  }
  throw new Error("The request key could not be claimed.");
}

// Stores the 200 answer, only while the claim is still this request's (the
// fence). False when the claim was lost: nothing is stored.
export async function completeRequest(
  db: Db,
  input: { claimId: string; status: number; body: unknown; now: Date },
): Promise<boolean> {
  const updated = await db
    .update(memberRequests)
    .set({
      state: "done",
      responseStatus: input.status,
      responseBody: input.body,
      completedAt: input.now,
    })
    .where(
      and(
        eq(memberRequests.claimId, input.claimId),
        eq(memberRequests.state, "pending"),
      ),
    )
    .returning({ id: memberRequests.id });
  return updated.length > 0;
}

// An answer of any other status is not stored: the claim is deleted, so the
// same request is processed again.
export async function releaseRequest(db: Db, claimId: string): Promise<void> {
  await db
    .delete(memberRequests)
    .where(
      and(
        eq(memberRequests.claimId, claimId),
        eq(memberRequests.state, "pending"),
      ),
    );
}

// Removes up to 100 rows made 24 hours ago or earlier; the stored body holds
// addresses. The row of the running request is kept.
export async function pruneRequests(
  db: Db,
  now: Date,
  keepClaimId: string,
): Promise<void> {
  const cutoff = new Date(now.getTime() - KEEP_MS + 1);
  const old = db
    .select({ id: memberRequests.id })
    .from(memberRequests)
    .where(
      and(
        lt(memberRequests.createdAt, cutoff),
        ne(memberRequests.claimId, keepClaimId),
      ),
    )
    .limit(PRUNE_LIMIT);
  await db.delete(memberRequests).where(inArray(memberRequests.id, old));
}
