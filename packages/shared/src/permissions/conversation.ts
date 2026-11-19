import {
  actorReason,
  adminOnly,
  authorOnly,
  channelOnly,
  conversationReason,
  decide,
  memberOnly,
  messageReason,
  notArchived,
} from "./checks.js";
import type {
  ActorInput,
  ConversationFacts,
  Decision,
  DeleteDecision,
  MessageFacts,
} from "./types.js";

// Reading: a member of the conversation, whatever its kind and whether or
// not it is archived. An Admin has no extra right to read (D-047).
export function canReadConversation(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
  ]);
}

// Sending, replying in a thread, reacting and attaching files.
export function canPostInConversation(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    notArchived(conv),
  ]);
}

export function canUseAtChannel(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    channelOnly(conv),
    notArchived(conv),
  ]);
}

// Pin and unpin, in a conversation of any kind.
export function canPinMessage(
  actor: ActorInput,
  conv: ConversationFacts,
): Decision {
  return decide([actorReason(actor), conversationReason(conv, "all")], () => [
    memberOnly(conv),
    notArchived(conv),
  ]);
}

// Only the author edits a message, an Admin included.
export function canEditMessage(
  actor: ActorInput,
  conv: ConversationFacts,
  msg: MessageFacts,
): Decision {
  return decide(
    [actorReason(actor), conversationReason(conv, "all"), messageReason(msg)],
    () => [memberOnly(conv), notArchived(conv), authorOnly(actor, msg)],
  );
}

// The author deletes their own message; an Admin who is a member deletes
// anyone's. An Admin who deletes their own message does it as the author.
export function canDeleteMessage(
  actor: ActorInput,
  conv: ConversationFacts,
  msg: MessageFacts,
): DeleteDecision {
  const asAuthor = decide(
    [actorReason(actor), conversationReason(conv, "all"), messageReason(msg)],
    () => [memberOnly(conv), notArchived(conv), authorOnly(actor, msg)],
  );
  if (asAuthor.allowed) return { allowed: true, as: "author" };
  if (asAuthor.reason !== "not_author") return asAuthor;
  return adminOnly(actor) === null ? { allowed: true, as: "admin" } : asAuthor;
}
