// The event of a changed person (R40). Published by a route after the commit
// of a role change, a deactivation or a reactivation that changed something.
// This module registers no listener.

export type MemberChange = {
  kind: "role_changed" | "account_deactivated" | "account_reactivated";
  actorId: string;
  targetId: string;
  before: { role: "member" | "admin"; status: "active" | "deactivated" };
  after: { role: "member" | "admin"; status: "active" | "deactivated" };
  // The time of the admin_actions row of the change.
  at: Date;
};

type Listener = (event: MemberChange) => void;
const listeners = new Set<Listener>();

export function onMemberChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A listener that throws is logged with the kind and the two ids; it does not
// stop the other listeners and never reaches the caller, whose change is
// already committed.
export function publishMemberChanged(
  event: MemberChange,
  log: { error: (fields: object, message: string) => void },
): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      log.error(
        { kind: event.kind, actorId: event.actorId, targetId: event.targetId },
        "a member-changed listener failed",
      );
    }
  }
}
