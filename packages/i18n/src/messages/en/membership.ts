// The texts of the Add people dialog and the Remove confirmation (TOKI-100 Table T).
export const membership = {
  add: {
    button: "Add people",
    title: "Add people to #{name}",
    confirm: "Add",
    nobody: "Everyone is already in this channel.",
    limit: "You can add up to {count} people at once.",
    error: { inactive: "Some of these people can no longer be added." },
  },
  remove: {
    button: "Remove",
    label: "Remove {name} from this channel",
    title: "Remove this person?",
    description:
      "The person named below will no longer be a member of #{channel}.",
    publicNotice:
      "This channel is public, so the person can join again from Browse channels.",
    privateNotice:
      "This channel is private, so a member will have to add the person back.",
    confirm: "Remove",
  },
};
