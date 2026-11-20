export const admin = {
  noAccess: {
    title: "You do not have access to this page",
  },
  invite: {
    open: "Invite members",
    title: "Invite members",
    emails: {
      label: "Email addresses",
      hint: "Separate addresses with commas or new lines.",
    },
    role: {
      label: "Role",
    },
    send: "Send invitations",
    error: {
      invalid: '"{address}" is not a valid email address.',
      tooMany: "Send at most {count} addresses at a time.",
    },
    results: {
      label: "Results",
    },
    result: {
      alreadyMember: "Already a member",
      alreadyInvited: "Already invited",
      invalid: "Not a valid address",
    },
    done: "Done",
  },
  members: {
    title: "Members",
    search: {
      label: "Search members",
      placeholder: "Search by name or address",
    },
    filter: {
      label: "Filter by status",
    },
    empty: {
      title: "Nobody matches",
      hint: "Try a name or an address.",
    },
    loading: "Loading members",
    error: "Could not load the members.",
  },
  filter: {
    all: "All",
  },
  status: {
    active: "Active",
    invited: "Invited",
    expired: "Expired",
    deactivated: "Deactivated",
  },
  col: {
    name: "Name",
    role: "Role",
    status: "Status",
    lastActive: "Last active",
    actions: "Actions",
  },
  row: {
    you: "You",
    mailNotSent: "Mail not sent",
    invitedBy: "Invited by {name} · {date}",
  },
  action: {
    menu: "Actions for {name}",
    resend: "Resend",
    revoke: "Revoke",
    changeRole: "Change role",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
  },
  lock: {
    lastAdmin: "Make someone else an Admin first",
    self: "You cannot deactivate yourself",
    current: "Current role",
  },
  changeRole: {
    title: "Change role?",
    toAdmin:
      "New role: Admin. They can open the Admin page, invite people, change roles and deactivate people.",
    toMember:
      "New role: Member. They can no longer open the Admin page or manage people.",
    confirm: "Change role",
  },
  deactivate: {
    title: "Deactivate this person?",
    description:
      "{name} will be signed out everywhere and cannot sign in again. Their messages stay.",
    confirm: "Deactivate",
  },
  reactivate: {
    title: "Reactivate this person?",
    description:
      "{name} can sign in again with a code sent to their address, with the same history and channels.",
    confirm: "Reactivate",
  },
  revoke: {
    title: "Revoke this invitation?",
    description:
      "The invitation to {email} stops working. The Join button in its mail will no longer let anyone in.",
    confirm: "Revoke",
  },
  channels: {
    members: {
      one: "{count} member",
      other: "{count} members",
    },
    archived: "Archived",
    loading: "Loading channels",
    error: "Could not load the channels.",
  },
  error: {
    retry: "Retry",
    id: "Error ID: {id}",
    stale: "This page was out of date. It has been refreshed.",
    inProgress: "Still sending. Try again in a moment.",
    unreadable: "This page is out of date. Reload it to continue.",
  },
  toast: {
    roleChanged: "Role changed",
    deactivated: "Deactivated",
    reactivated: "Reactivated",
    revoked: "Invitation revoked",
    resent: "Invitation sent to {email}",
    resentNoMail: "Mail not sent to {email}",
  },
};
