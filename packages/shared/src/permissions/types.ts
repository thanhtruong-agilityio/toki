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
