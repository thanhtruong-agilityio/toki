import type { StorageArea } from "@toki/platform";
import { readStored, writeStored } from "./device-memory";

export const LAST_VIEWED_KEY = "conversationList.lastViewed";

export function readLastViewed(
  storage: StorageArea,
  userId: string,
): string | null {
  const value = readStored(storage, LAST_VIEWED_KEY, userId);
  return typeof value === "string" ? value : null;
}

export function writeLastViewed(
  storage: StorageArea,
  userId: string,
  conversationId: string,
): void {
  writeStored(storage, LAST_VIEWED_KEY, userId, conversationId);
}

// The conversation to open when none is named (R22): the last viewed one when it is still in the
// list, else #general, which is always in the list (D-034). `null` while #general is not known yet.
export function viewFallback(
  storage: StorageArea,
  userId: string,
  store: {
    hasConversation(id: string): boolean;
    getGeneralId(): string | null;
  },
): string | null {
  const last = readLastViewed(storage, userId);
  if (last !== null && store.hasConversation(last)) return last;
  return store.getGeneralId();
}
