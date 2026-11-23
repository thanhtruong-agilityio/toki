import type { ConversationStore } from "@toki/client-core";
import { useSyncExternalStore } from "react";
import { conversations } from "../client";

// The one React binding of the store of `client.ts` (R29). `select` reads the store through its
// getters and must return a value that stays the same while nothing it read changes (the store's
// selectors do, TOKI-032 R22), so the caller re-renders only when what it asked for changes.
export function useConversationSelector<T>(
  select: (store: ConversationStore) => T,
): T {
  const read = () => select(conversations);
  return useSyncExternalStore(conversations.subscribe, read, read);
}
