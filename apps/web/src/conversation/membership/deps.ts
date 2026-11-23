// The one seam of this work (R2): the only file of `membership/` that imports the client or
// `@toki/client-core`. The tests of the screens replace it with `vi.mock`.
import { useConversationSelector } from "../../conversation-list/use-conversations";

export { api, conversations } from "../../client";
export { ApiError, classifyApiError } from "@toki/client-core";
export { useConversationSelector };
export { PeoplePicker } from "../../features/people/PeoplePicker";
export { useCurrentUserId, usePeople } from "../../features/deps";
export { personHue } from "../../people/person-hue";

// The role of the signed-in person, from the store's user (TOKI-031 R3).
export function useCurrentRole(): string | null {
  return useConversationSelector((store) => store.getUser()?.role ?? null);
}

// The channel's name as the store shows it, for the dialog's title.
export function useChannelName(id: string): string {
  return useConversationSelector((store) => store.getConversationName(id));
}

// The three facts of `membershipOffers` (R4), each asked in its own call so that a selector returns
// the same object while nothing it reads changes.
export function useConversationEntry(id: string) {
  return useConversationSelector((store) => store.getConversation(id));
}

export function useChannelDetail(id: string) {
  return useConversationSelector((store) => store.getChannelDetail(id));
}

export function useCurrentUser() {
  return useConversationSelector((store) => store.getUser());
}
