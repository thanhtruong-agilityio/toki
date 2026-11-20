import type {
  BootstrapConversation,
  BootstrapPerson,
  BootstrapUser,
  BootstrapWorkspace,
  ChannelDetail,
  ChannelSummary,
} from "@toki/shared";
import type { ApiError } from "../api/errors";

export type ConversationStatus = "idle" | "loading" | "ready" | "failed";

export type Unread = { count: number; mention: boolean };

export type ChannelRead = ChannelDetail | ChannelSummary;

// The state the screens read (TOKI-032 R10). Replaced, never changed in
// place, so `getState()` is a snapshot and `useSyncExternalStore` can compare.
export type ConversationState = {
  status: ConversationStatus;
  isRefreshing: boolean;
  error: ApiError | null;
  user: BootstrapUser | null;
  workspace: BootstrapWorkspace | null;
  // By id, in the order the server sent.
  people: Readonly<Record<string, BootstrapPerson>>;
  // The same people as one array, built once when a load sets `people`
  // (R22: `getPeople()` returns it by reference).
  peopleList: readonly BootstrapPerson[];
  conversations: Readonly<Record<string, BootstrapConversation>>;
  details: Readonly<Record<string, ChannelRead>>;
  unread: Readonly<Record<string, Unread>>;
  eventNumber: number;
};

export type SettingsValues = {
  notificationLevel: "all" | "mentions" | "none";
  isMuted: boolean;
  isStarred: boolean;
};

export type ListFilter = "all" | "unread" | "mentions";

export type ListRow = {
  id: string;
  kind: "channel" | "dm" | "group_dm";
  name: string;
  isPrivate: boolean;
  isGeneral: boolean;
  isStarred: boolean;
  isMuted: boolean;
  notificationLevel: "all" | "mentions" | "none";
  unreadCount: number;
  hasMention: boolean;
  otherPersonId: string | null;
};

export type ConversationList = {
  starred: ListRow[];
  channels: ListRow[];
  direct: ListRow[];
  isEmpty: boolean;
};
