import type { DbClient } from "../../db/client.js";
import { adminActions } from "./schema.js";

export type AdminAction =
  | "invitation_created"
  | "invitation_resent"
  | "invitation_revoked"
  | "role_changed"
  | "account_deactivated"
  | "account_reactivated";

// One row of the record of administrative actions (R31, D-110). The caller
// passes the transaction of the change, so the record and the change are
// committed together or not at all. The table is append-only.
export async function recordAction(
  tx: DbClient,
  input: {
    workspaceId: string;
    actorId: string;
    action: AdminAction;
    targetUserId?: string | null;
    targetEmail?: string | null;
    detail: Record<string, unknown>;
    at: Date;
  },
): Promise<void> {
  await tx.insert(adminActions).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    targetEmail: input.targetEmail ?? null,
    detail: input.detail,
    createdAt: input.at,
  });
}
