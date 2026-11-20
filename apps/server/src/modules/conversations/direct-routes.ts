import {
  OpenDirectBodySchema,
  canCreateDirectConversation,
} from "@toki/shared";
import { refusal } from "./access.js";
import type { DirectDeps } from "./deps.js";
import { planDirectConversation } from "./direct.js";
import { AppError } from "../../errors.js";
import { ErrorCodes, DIRECT_CONVERSATION_MAX_OTHERS } from "@toki/shared";
import { openDirect, type OpenDirectResult } from "./direct-open.js";

// Everything the route decides (R3): the permission of the account, the body,
// the people and the size, then the transaction. The account is an argument,
// so a test can pass a role that no session can produce.
export async function handleOpenDirect(
  deps: DirectDeps,
  account: { id: string; role: string },
  body: unknown,
): Promise<OpenDirectResult> {
  const mayTakePart =
    deps.canCreateDirectConversation ?? canCreateDirectConversation;
  const decision = mayTakePart({ id: account.id, role: account.role });
  if (!decision.allowed) throw refusal(decision.reason);

  const { userIds } = OpenDirectBodySchema.parse(body ?? {});
  const plan = planDirectConversation(account.id, userIds);
  if (!plan.ok) {
    if (plan.refusal === "direct_with_self") {
      throw new AppError(
        400,
        ErrorCodes.directWithSelf,
        "You cannot start a conversation with yourself.",
      );
    }
    throw new AppError(
      400,
      ErrorCodes.groupTooLarge,
      "A group has too many people.",
      {
        max: DIRECT_CONVERSATION_MAX_OTHERS + 1,
        maxOthers: DIRECT_CONVERSATION_MAX_OTHERS,
      },
    );
  }
  return openDirect(deps, account.id, plan);
}
