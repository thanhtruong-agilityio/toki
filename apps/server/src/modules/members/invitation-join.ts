import {
  CODE_TTL_SECONDS,
  INVITATION_RESEND_SECONDS,
  type InvitationLookupResponse,
} from "@toki/shared";
import type { Db } from "../../db/client.js";
import { getWorkspace } from "../workspace/index.js";
import { findInvitationByToken } from "./invitations.js";

// What is left of a wait, in whole seconds rounded up and never below 0 (R4).
const secondsLeft = (total: number, ageMs: number) =>
  Math.max(0, Math.ceil(total - ageMs / 1000));

// "What is this link" (R1 to R5). It reads, and writes nothing. A token of the wrong shape finds no
// invitation without a query (R2); a token that a Resend replaced finds none either (R3).
export async function lookupInvitation(
  db: Db,
  token: string,
  now: Date,
): Promise<InvitationLookupResponse> {
  const found = await findInvitationByToken(db, token, now);
  if (!found) return { state: "unknown" };
  if (found.state === "used") return { state: "used", email: found.email };
  const workspace = await getWorkspace(db);
  if (!workspace) throw new Error("There is no workspace.");
  if (found.state === "expired" || found.state === "revoked") {
    return { state: found.state, workspaceName: workspace.name };
  }
  const age = now.getTime() - found.codeIssuedAt.getTime();
  return {
    state: "pending",
    email: found.email,
    workspaceName: workspace.name,
    codeExpiresInSeconds: secondsLeft(CODE_TTL_SECONDS, age),
    resendAfterSeconds: secondsLeft(INVITATION_RESEND_SECONDS, age),
  };
}
