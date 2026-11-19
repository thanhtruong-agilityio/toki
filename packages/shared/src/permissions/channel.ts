import {
  actorReason,
  adminOnly,
  channelOnly,
  conversationReason,
  decide,
  memberOnly,
  notArchived,
  notGeneral,
  publicOnly,
} from "./checks.js";
import type { ActorInput, ConversationFacts, Decision } from "./types.js";

export function canCreateChannel(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => [adminOnly(actor)]);
}

// DMs and group DMs. The argument is any person: a caller may also ask
// whether another person may take part in a direct conversation.
export function canCreateDirectConversation(actor: ActorInput): Decision {
  return decide([actorReason(actor)], () => []);
}

// Joining needs no `isMember` fact. A private channel is rejoined only when
// a member adds the person back (D-051).
export function canJoinChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide(
    [actorReason(actor), conversationReason(conv, "no_member")],
    () => [channelOnly(conv), publicOnly(conv), notArchived(conv)],
  );
}

export function canAddPeopleToChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    channelOnly(conv),
    notArchived(conv),
  ]);
}

export function canRemovePeopleFromChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    adminOnly(actor),
    memberOnly(conv),
    channelOnly(conv),
    notGeneral(conv),
    notArchived(conv),
  ]);
}

// Leaving an archived channel is allowed; #general is never left (D-034).
export function canLeaveChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    channelOnly(conv),
    notGeneral(conv),
  ]);
}

// Whether the channel is archived already is not checked here: that
// conflict belongs to the API.
export function canArchiveChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    adminOnly(actor),
    memberOnly(conv),
    channelOnly(conv),
    notGeneral(conv),
  ]);
}

// Any Admin restores, a member of the channel or not, so it reads only the
// kind and #general. Making that Admin a member, and hiding a private
// channel from a person who is not a member, is the work of the API.
export function canRestoreChannel(
  actor: ActorInput,
  conv: Pick<ConversationFacts, "kind" | "isGeneral">,
): Decision {
  return decide(
    [actorReason(actor), conversationReason(conv, "kind_only")],
    () => [adminOnly(actor), channelOnly(conv), notGeneral(conv)],
  );
}

// The topic and the description. The name and the privacy of a channel are
// never edited.
export function canEditChannelDetails(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    channelOnly(conv),
    notArchived(conv),
  ]);
}
