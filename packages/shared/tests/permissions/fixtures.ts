import type {
  Actor,
  ConversationFacts,
  DenyReason,
  TargetPerson,
} from "../../src/index.js";

// Fake ids and names only.
export const member: Actor = { id: "user-mai", role: "member" };
export const admin: Actor = { id: "user-lan", role: "admin" };
export const roles: Actor[] = [member, admin];

// A public channel that is not #general, not archived, and of which the
// actor is a member; each test changes only the facts it is about.
export function conv(over: Partial<ConversationFacts> = {}): ConversationFacts {
  return {
    kind: "public_channel",
    isGeneral: false,
    archived: false,
    isMember: true,
    ...over,
  };
}

export function person(over: Partial<TargetPerson> = {}): TargetPerson {
  return { id: "user-minh", role: "member", status: "active", ...over };
}

export const allow = { allowed: true };
export function deny(reason: DenyReason) {
  return { allowed: false, reason };
}
