import type { ConversationFacts } from "../../src/index.js";
import { admin, conv, person } from "./fixtures.js";

// One entry for each permission function: arguments with which it allows,
// and where each of its facts is. `[1, "kind"]` is the property `kind` of
// the second argument; `[2, null]` is the third argument itself.
export type FactPath = [arg: number, key: string | null];
export type FunctionCase = {
  args: () => unknown[];
  facts: FactPath[];
};

const ACTOR: FactPath[] = [
  [0, null],
  [0, "id"],
  [0, "role"],
];

// The three sets of conversation facts a function may need (plan, Design 3).
function conversation(keys: (keyof ConversationFacts)[]): FactPath[] {
  return [[1, null], ...keys.map((key): FactPath => [1, key])];
}
const ALL = conversation(["kind", "isGeneral", "archived", "isMember"]);
const NO_MEMBER = conversation(["kind", "isGeneral", "archived"]);
const KIND_ONLY = conversation(["kind", "isGeneral"]);

const MESSAGE: FactPath[] = [
  [2, null],
  [2, "authorId"],
];
const TARGET: FactPath[] = [
  [1, null],
  [1, "id"],
  [1, "role"],
  [1, "status"],
];

const onlyActor: FunctionCase = { args: () => [{ ...admin }], facts: ACTOR };
const withConversation: FunctionCase = {
  args: () => [{ ...admin }, conv()],
  facts: [...ACTOR, ...ALL],
};
const withMessage: FunctionCase = {
  args: () => [{ ...admin }, conv(), { authorId: admin.id }],
  facts: [...ACTOR, ...ALL, ...MESSAGE],
};

export const cases: Record<string, FunctionCase> = {
  canReadConversation: withConversation,
  canPostInConversation: withConversation,
  canUseAtChannel: withConversation,
  canPinMessage: withConversation,
  canEditMessage: withMessage,
  canDeleteMessage: withMessage,
  canCreateChannel: onlyActor,
  canCreateDirectConversation: onlyActor,
  canJoinChannel: {
    args: () => [{ ...admin }, conv()],
    facts: [...ACTOR, ...NO_MEMBER],
  },
  canAddPeopleToChannel: withConversation,
  canRemovePeopleFromChannel: withConversation,
  canLeaveChannel: withConversation,
  canArchiveChannel: withConversation,
  canRestoreChannel: {
    args: () => [{ ...admin }, conv()],
    facts: [...ACTOR, ...KIND_ONLY],
  },
  canEditChannelDetails: withConversation,
  canUseWorkspaceViews: onlyActor,
  canOpenAdminPage: onlyActor,
  canInviteMember: {
    args: () => [{ ...admin }, { role: "member" }],
    facts: [...ACTOR, [1, null], [1, "role"]],
  },
  canManageInvitations: onlyActor,
  canChangeRole: {
    args: () => [{ ...admin }, person(), "admin", 2],
    facts: [...ACTOR, ...TARGET, [2, null], [3, null]],
  },
  canDeactivateAccount: {
    args: () => [{ ...admin }, person(), 2],
    facts: [...ACTOR, ...TARGET, [2, null]],
  },
  canReactivateAccount: onlyActor,
};

// The exported `can…` functions, read from the module itself.
type AnyFunction = (...args: unknown[]) => {
  allowed: boolean;
  reason?: string;
};
export function permissionFunctions(
  module: Record<string, unknown>,
): Record<string, AnyFunction> {
  return Object.fromEntries(
    Object.entries(module).filter(
      ([name, value]) => name.startsWith("can") && typeof value === "function",
    ),
  ) as Record<string, AnyFunction>;
}
