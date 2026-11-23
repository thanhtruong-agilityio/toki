// The texts of archiving and restoring a channel (TOKI-101 Table T). Every text is a proposal (D-139).
export const archive = {
  button: "Archive channel",
  title: "Archive this channel?",
  message: {
    one: "It will leave everyone's list and nobody will be able to post in it. {count} member can still read its history.",
    other:
      "It will leave everyone's list and nobody will be able to post in it. {count} members can still read its history.",
  },
  confirm: "Archive",
  done: "Archived #{name}",
  label: "Archived",
  notice: "This channel has been archived",
  restore: "Restore",
  restoreNamed: "Restore #{name}",
  restoreTitle: "Restore this channel?",
  restoreMessage:
    "It will come back to the list of every member of the channel.",
  restoreConfirm: "Restore",
  restored: "Restored #{name}",
};
