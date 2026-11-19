import {
  actorReason,
  adminOnly,
  countReason,
  decide,
  lastAdmin,
  roleValueReason,
  targetReason,
} from "./checks.js";
import type { ActorInput, Decision, Role, TargetPerson } from "./types.js";

// Activity, Later, Files, People and Ctrl+K.
export function canUseWorkspaceViews(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => []);
}

// Also answers the member list of the Admin page.
export function canOpenAdminPage(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => [adminOnly(actor)]);
}

export function canInviteMember(
  actor: ActorInput,
  invite: { role: string },
): Decision {
  const invitedRole: unknown =
    typeof invite === "object" && invite !== null ? invite.role : undefined;
  return decide([actorReason(actor), roleValueReason(invitedRole)], () => [
    adminOnly(actor),
  ]);
}

// Resend, revoke and list invitations.
export function canManageInvitations(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => [adminOnly(actor)]);
}

// `activeAdminCount` is the number of active Admins of the workspace, the
// target included. The answer holds only for the count that is passed: the
// caller reads it from rows it has locked.
export function canChangeRole(
  actor: ActorInput,
  target: TargetPerson,
  newRole: Role,
  activeAdminCount: number,
): Decision {
  return decide(
    [
      actorReason(actor),
      targetReason(target),
      roleValueReason(newRole),
      countReason(activeAdminCount),
    ],
    () => [
      adminOnly(actor),
      newRole === "member" ? lastAdmin(target, activeAdminCount) : null,
    ],
  );
}

export function canDeactivateAccount(
  actor: ActorInput,
  target: TargetPerson,
  activeAdminCount: number,
): Decision {
  return decide(
    [actorReason(actor), targetReason(target), countReason(activeAdminCount)],
    () => [
      adminOnly(actor),
      target.id === actor.id ? "self_target" : null,
      lastAdmin(target, activeAdminCount),
    ],
  );
}

export function canReactivateAccount(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => [adminOnly(actor)]);
}
