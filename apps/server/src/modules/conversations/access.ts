import type { ConversationFacts, Decision } from "@toki/shared";
import { ErrorCodes } from "@toki/shared";
import type { DbClient } from "../../db/client.js";
import { AppError } from "../../errors.js";
import type { ChannelDeps } from "./deps.js";

export type Actor = { id: string; role: string };
export type Permission = (actor: Actor, conv: ConversationFacts) => Decision;

const notFound = () =>
  new AppError(404, ErrorCodes.notFound, "No such channel.");

// The answer to a refusal of a permission function (R2). The body holds no
// channel name, topic or description.
export function refusal(reason: string): Error {
  switch (reason) {
    case "role_not_allowed":
    case "not_a_member":
      return new AppError(
        403,
        ErrorCodes.forbidden,
        "You are not allowed to do this.",
      );
    case "private_channel":
    case "not_a_channel":
      return notFound();
    case "channel_is_general":
      return new AppError(
        409,
        ErrorCodes.channelIsGeneral,
        "This cannot be done in #general.",
      );
    case "channel_archived":
      return new AppError(
        409,
        ErrorCodes.channelArchived,
        "The channel is archived.",
      );
    default:
      // fact_missing, unknown_role and anything else: a server failure, which
      // the shared handler logs and answers as 500 internal_error.
      return new Error(`A permission function refused with ${reason}.`);
  }
}

// Steps 3 and 4 of R1: read the facts, hide what must be hidden, then call
// the permission function. Used before the transaction and again inside it
// with the locked actor (R1 step 5). The facts read comes from `deps`, so a
// test can replace it.
export async function checkAccess(
  deps: Pick<ChannelDeps, "getConversationFacts">,
  client: DbClient,
  actor: Actor,
  id: string,
  permission: Permission,
): Promise<ConversationFacts> {
  const facts = await deps.getConversationFacts(client, actor.id, id);
  // An unknown id, a DM or a group is never confirmed, and a private channel
  // of which the actor is not a member answers like an unknown id before any
  // permission function runs (BR-10, D-051).
  if (
    facts === null ||
    facts.kind === "dm" ||
    facts.kind === "group_dm" ||
    (facts.kind === "private_channel" && !facts.isMember)
  ) {
    throw notFound();
  }
  const decision = permission(actor, facts);
  if (!decision.allowed) throw refusal(decision.reason);
  return facts;
}
