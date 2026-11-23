import type { StorageArea } from "@toki/platform";
import type { ListFilter } from "@toki/client-core";
import { conversationGroupIds, type ConversationGroupId } from "@toki/ui-web";

export const FILTER_KEY = "conversationList.filter";
export const COLLAPSED_KEY = "conversationList.collapsed";

// False until TOKI-053 gives the list its counts: a stored `unread` or `mentions` is not restored
// then, and `all` is used (R18, concern 21). TOKI-053 sets it to true.
export const readStateAvailable = false;

// One JSON text with the person inside it, so a second person on the same device does not inherit
// the first one's choice (R18). Anything that is not that shape reads as nothing.
export function readStored(
  storage: StorageArea,
  key: string,
  userId: string,
): unknown {
  const text = storage.get(key);
  if (text === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { userId?: unknown }).userId === userId
    ) {
      return (parsed as { value?: unknown }).value;
    }
  } catch {
    // not valid JSON: the default
  }
  return undefined;
}

// A refused write (it returns false) leaves the state in memory and shows no error (R18).
export function writeStored(
  storage: StorageArea,
  key: string,
  userId: string,
  value: unknown,
): void {
  storage.set(key, JSON.stringify({ userId, value }));
}

const filters: readonly ListFilter[] = ["all", "unread", "mentions"];

export function readFilter(
  storage: StorageArea,
  userId: string,
  available: boolean = readStateAvailable,
): ListFilter {
  const value = readStored(storage, FILTER_KEY, userId);
  const known = filters.find((f) => f === value);
  if (known === undefined) return "all";
  return known !== "all" && !available ? "all" : known;
}

export function writeFilter(
  storage: StorageArea,
  userId: string,
  filter: ListFilter,
): void {
  writeStored(storage, FILTER_KEY, userId, filter);
}

export function readCollapsed(
  storage: StorageArea,
  userId: string,
): ConversationGroupId[] {
  const value = readStored(storage, COLLAPSED_KEY, userId);
  if (!Array.isArray(value)) return [];
  const ids = conversationGroupIds as readonly unknown[];
  if (!value.every((id) => ids.includes(id))) return [];
  return value as ConversationGroupId[];
}

export function writeCollapsed(
  storage: StorageArea,
  userId: string,
  ids: readonly ConversationGroupId[],
): void {
  writeStored(storage, COLLAPSED_KEY, userId, ids);
}
