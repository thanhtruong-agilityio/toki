import { DENY_REASONS } from "./types.js";
import type {
  ActorInput,
  ConversationFacts,
  Decision,
  DenyReason,
  MessageFacts,
  TargetPerson,
} from "./types.js";

// The checks every permission function is built from. Each returns the
// reason to refuse, or null. A function never orders its reasons by hand:
// `first` picks the one that comes first in DENY_REASONS.

type Reason = DenyReason | null;

export function first(reasons: readonly Reason[]): Reason {
  let best: Reason = null;
  for (const reason of reasons) {
    if (
      reason !== null &&
      (best === null ||
        DENY_REASONS.indexOf(reason) < DENY_REASONS.indexOf(best))
    ) {
      best = reason;
    }
  }
  return best;
}

// `facts` are the checks that the arguments are there and well formed.
// `rules` runs only when they are, so a rule may read its facts freely.
export function decide(
  facts: readonly Reason[],
  rules: () => readonly Reason[],
): Decision {
  const reason = first(facts) ?? first(rules());
  return reason === null ? { allowed: true } : { allowed: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isId(value: unknown): boolean {
  return typeof value === "string" && value !== "";
}

// A role passed as a value: the role of an actor or a target, an invited
// role, a new role.
export function roleValueReason(role: unknown): Reason {
  if (typeof role !== "string") return "fact_missing";
  return role === "member" || role === "admin" ? null : "unknown_role";
}

export function actorReason(actor: unknown): Reason {
  if (!isRecord(actor) || !isId(actor.id)) return "fact_missing";
  return roleValueReason(actor.role);
}

// Which facts of a conversation a function needs: all four, all but
// `isMember`, or only `kind` and `isGeneral`.
export type ConversationNeeds = "all" | "no_member" | "kind_only";

const KINDS: readonly unknown[] = [
  "public_channel",
  "private_channel",
  "dm",
  "group_dm",
];

export function conversationReason(
  conv: unknown,
  needs: ConversationNeeds,
): Reason {
  if (!isRecord(conv)) return "fact_missing";
  if (!KINDS.includes(conv.kind)) return "fact_missing";
  if (typeof conv.isGeneral !== "boolean") return "fact_missing";
  // Only a public channel can be #general: anything else is a slip of the
  // code that read the facts.
  if (conv.isGeneral && conv.kind !== "public_channel") return "fact_missing";
  if (needs !== "kind_only" && typeof conv.archived !== "boolean") {
    return "fact_missing";
  }
  if (needs === "all" && typeof conv.isMember !== "boolean") {
    return "fact_missing";
  }
  return null;
}

export function messageReason(msg: unknown): Reason {
  return isRecord(msg) && isId(msg.authorId) ? null : "fact_missing";
}

export function targetReason(target: unknown): Reason {
  if (!isRecord(target) || !isId(target.id)) return "fact_missing";
  if (target.status !== "active" && target.status !== "deactivated") {
    return "fact_missing";
  }
  return roleValueReason(target.role);
}

export function countReason(count: unknown): Reason {
  return typeof count === "number" && Number.isInteger(count) && count >= 0
    ? null
    : "fact_missing";
}

// The rules. Each reads facts that the checks above have accepted.

export function adminOnly(actor: ActorInput): Reason {
  return actor.role === "admin" ? null : "role_not_allowed";
}

export function memberOnly(conv: Pick<ConversationFacts, "isMember">): Reason {
  return conv.isMember ? null : "not_a_member";
}

export function channelOnly(conv: Pick<ConversationFacts, "kind">): Reason {
  return conv.kind === "public_channel" || conv.kind === "private_channel"
    ? null
    : "not_a_channel";
}

export function publicOnly(conv: Pick<ConversationFacts, "kind">): Reason {
  return conv.kind === "private_channel" ? "private_channel" : null;
}

export function notGeneral(conv: Pick<ConversationFacts, "isGeneral">): Reason {
  return conv.isGeneral ? "channel_is_general" : null;
}

export function notArchived(conv: Pick<ConversationFacts, "archived">): Reason {
  return conv.archived ? "channel_archived" : null;
}

export function authorOnly(actor: ActorInput, msg: MessageFacts): Reason {
  return msg.authorId === actor.id ? null : "not_author";
}

// Whether losing this person as an Admin would leave the workspace with no
// active Admin. The count includes the target.
export function lastAdmin(
  target: TargetPerson,
  activeAdminCount: number,
): Reason {
  return target.role === "admin" &&
    target.status === "active" &&
    activeAdminCount <= 1
    ? "last_admin"
    : null;
}
