// The facts of a conversation that the permission functions read (TOKI-027
// R2). TOKI-028 defines this type first, because TOKI-027 is not built yet;
// TOKI-027 adds the other types to this file and does not redefine this one.
// `isMember` is whether the actor is a member of that conversation.
export type ConversationFacts = {
  kind: "public_channel" | "private_channel" | "dm" | "group_dm";
  isGeneral: boolean;
  archived: boolean;
  isMember: boolean;
};

// The two roles of phase 1. There is no Owner (D-152); Guest arrives with
// its own ticket.
export type Role = "member" | "admin";

export type Actor = { id: string; role: Role };

// The person who acts, as a caller passes them: the role is the text the
// account stores, not narrowed, so a value the module does not know reaches
// the function and is refused as `unknown_role`.
export type ActorInput = { id: string; role: string };

export type MessageFacts = { authorId: string };

// The person a role change or a deactivation is about.
export type TargetPerson = {
  id: string;
  role: Role;
  status: "active" | "deactivated";
};

// The reason codes, in the order a function names them when several apply.
export const DENY_REASONS = [
  "fact_missing",
  "unknown_role",
  "role_not_allowed",
  "not_a_member",
  "not_a_channel",
  "private_channel",
  "channel_is_general",
  "channel_archived",
  "not_author",
  "self_target",
  "last_admin",
] as const;

export type DenyReason = (typeof DENY_REASONS)[number];

export type Decision =
  { allowed: true } | { allowed: false; reason: DenyReason };

// The result of `canDeleteMessage`: `as` tells the caller whether to show
// 'Message deleted by an admin' (D-049).
export type DeleteDecision =
  | { allowed: true; as: "author" | "admin" }
  | { allowed: false; reason: DenyReason };
