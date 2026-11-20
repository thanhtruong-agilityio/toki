import type { BootstrapConversation } from "@toki/shared";
import { compareByName } from "./names";
import { matches } from "./search";
import type {
  ConversationList,
  ConversationState,
  ListFilter,
  ListRow,
  Unread,
} from "./types";

// Direct conversations are ordered by name until the latest message of a
// conversation exists (TOKI-032 R18; TOKI-037 changes this one function).
export const compareDirect = compareByName;

const NO_UNREAD: Unread = { count: 0, mention: false };

// The list the sidebar draws (R21): the three groups, already filtered and
// ordered. `nameOf` is the name of a conversation (R17), computed once per
// state by the store. A group is an empty array when nothing is in it; hiding
// it is the screen's.
export function buildList(
  state: ConversationState,
  nameOf: (id: string) => string,
  query: string,
  filter: ListFilter,
): ConversationList {
  const rows: { row: ListRow; entry: BootstrapConversation }[] = [];
  const userId = state.user?.id;
  for (const entry of Object.values(state.conversations)) {
    const name = nameOf(entry.id);
    if (!matches(name, query)) continue;
    const slot = state.unread[entry.id] ?? NO_UNREAD;
    if (filter === "unread" && !(slot.count > 0)) continue;
    if (filter === "mentions" && !slot.mention) continue;
    rows.push({
      entry,
      row: {
        id: entry.id,
        kind: entry.kind,
        name,
        isPrivate: entry.isPrivate,
        isGeneral: entry.isGeneral,
        isStarred: entry.isStarred,
        isMuted: entry.isMuted,
        notificationLevel: entry.notificationLevel,
        unreadCount: slot.count,
        hasMention: slot.mention,
        otherPersonId:
          entry.kind === "dm"
            ? (entry.memberIds.find((memberId) => memberId !== userId) ?? null)
            : null,
      },
    });
  }
  const pick = (keep: (entry: BootstrapConversation) => boolean) =>
    rows.filter((r) => keep(r.entry)).map((r) => r.row);
  const starred = pick((e) => e.isStarred).sort(compareByName);
  const channels = pick((e) => !e.isStarred && e.kind === "channel").sort(
    compareByName,
  );
  const direct = pick((e) => !e.isStarred && e.kind !== "channel").sort(
    compareDirect,
  );
  return {
    starred,
    channels,
    direct,
    isEmpty: starred.length + channels.length + direct.length === 0,
  };
}
