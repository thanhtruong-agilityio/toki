// Limits, names and levels of conversations (TOKI-028 R15). The server's
// constraints and the web app's forms read these values, so both sides agree.

export const CHANNEL_NAME_MAX = 80;
export const CHANNEL_TOPIC_MAX = 250;
export const CHANNEL_DESCRIPTION_MAX = 500;
export const GROUP_DM_MAX_PEOPLE = 8;

// Lower-case letters, digits and hyphens (D-040). Not global: test() keeps no
// state between calls.
export const CHANNEL_NAME_PATTERN = new RegExp(
  `^[a-z0-9-]{1,${CHANNEL_NAME_MAX}}$`,
);

export const NOTIFICATION_LEVELS = ["all", "mentions", "none"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export type ConversationKind = "channel" | "dm" | "group_dm";

// null or 1 to max characters. Counts code points with Array.from, as Postgres
// char_length does, never .length (UTF-16 units).
function isNullOrWithin(value: unknown, max: number): boolean {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const length = Array.from(value).length;
  return length >= 1 && length <= max;
}

export function isValidChannelTopic(value: string | null): boolean {
  return isNullOrWithin(value, CHANNEL_TOPIC_MAX);
}

export function isValidChannelDescription(value: string | null): boolean {
  return isNullOrWithin(value, CHANNEL_DESCRIPTION_MAX);
}

// The level that applies to a member: the stored one, or the default of the
// conversation's kind (D-046): mentions for a channel, all for a DM or group.
export function effectiveNotificationLevel(
  kind: ConversationKind,
  level: NotificationLevel | null,
): NotificationLevel {
  if (level !== null) return level;
  return kind === "channel" ? "mentions" : "all";
}
