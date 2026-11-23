// The one seam of this change (TOKI-101 R2): the only file of the folder that imports
// `@toki/client-core` or the client. A rename there changes this file only, and the tests of the
// screens replace it with `vi.mock`.
import { useConversationSelector } from "../conversation-list/use-conversations";

export { conversations } from "../client";
export { classifyApiError } from "@toki/client-core";
export type { ChannelRead } from "@toki/client-core";
export { useConversationSelector };
// The same read as the header and the panel use, so the page shares their request (R16).
export { readChannelOnce } from "../conversation/useConversation";

// `getUser()` keeps its identity until the store changes (TOKI-032 R22), so this is the snapshot of
// `useSyncExternalStore` as it is.
export function useCurrentUser() {
  return useConversationSelector((s) => s.getUser());
}
