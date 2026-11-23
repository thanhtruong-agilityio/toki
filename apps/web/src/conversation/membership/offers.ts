import {
  canAddPeopleToChannel,
  canRemovePeopleFromChannel,
  type ConversationFacts,
} from "@toki/shared";

export type MembershipOffers = { add: boolean; removeRows: boolean };

type EntryFacts =
  | { kind: "channel"; isPrivate: boolean; isGeneral: boolean }
  | { kind: "dm" | "group_dm" };

// Who is offered which control (R4). The facts are the ones the permission functions of
// `@toki/shared` read, so the screen and the server follow one rule and no role is compared here.
// A missing fact denies (TOKI-027 R4); the panel is only opened by a member, so `isMember` is true.
export function membershipOffers({
  conversation,
  detail,
  actor,
}: {
  conversation: EntryFacts | undefined;
  detail: { archived: boolean } | null | undefined;
  actor: { id: string; role: string } | null | undefined;
}): MembershipOffers {
  const none = { add: false, removeRows: false };
  if (!conversation || !detail || !actor) return none;
  const facts: ConversationFacts = {
    kind:
      conversation.kind === "channel"
        ? conversation.isPrivate
          ? "private_channel"
          : "public_channel"
        : conversation.kind,
    isGeneral: conversation.kind === "channel" && conversation.isGeneral,
    archived: detail.archived,
    isMember: true,
  };
  return {
    add: canAddPeopleToChannel(actor, facts).allowed,
    removeRows: canRemovePeopleFromChannel(actor, facts).allowed,
  };
}
