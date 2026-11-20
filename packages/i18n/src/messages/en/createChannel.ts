// The texts of the Create channel dialog (TOKI-098 Table T).
export const createChannel = {
  open: "Create channel",
  title: "Create channel",
  name: {
    label: "Name",
    error: {
      invalid: "Use only lowercase letters, digits and hyphens.",
      taken: "A channel with this name already exists.",
    },
  },
  error: {
    tooLong: "Use {count} characters or fewer.",
    invalidMember:
      "Someone you chose can no longer be added. Check the list and try again.",
  },
  private: {
    label: "Private",
    hint: "Only its members can find it. This cannot be changed later.",
  },
  topic: { label: "Topic (optional)" },
  people: {
    label: "Add people (optional)",
    limit: "You can add up to {count} people.",
  },
  submit: "Create",
};
