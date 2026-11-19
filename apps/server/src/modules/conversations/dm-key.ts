import { GROUP_DM_MAX_PEOPLE } from "@toki/shared";

// The key of a direct message or group (R10, R11): the people's ids in lower
// case, sorted in byte order, each once, joined by commas. The same set of
// people always gives the same key, so the database holds one conversation per
// set (a unique key per workspace).

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type DmKey = { kind: "dm" | "group_dm"; key: string };

export function buildDmKey(userIds: readonly string[]): DmKey {
  const lower = userIds.map((id) => {
    if (typeof id !== "string" || !UUID.test(id)) {
      throw new Error(`buildDmKey: ${JSON.stringify(id)} is not a UUID`);
    }
    return id.toLowerCase();
  });
  if (new Set(lower).size !== lower.length) {
    throw new Error("buildDmKey: a person is repeated");
  }
  if (lower.length < 2) {
    throw new Error("buildDmKey: a conversation needs at least 2 people");
  }
  if (lower.length > GROUP_DM_MAX_PEOPLE) {
    throw new Error(
      `buildDmKey: more than ${GROUP_DM_MAX_PEOPLE} people in a group`,
    );
  }
  // Default sort compares UTF-16 units; for lower-case hex and hyphens
  // (all ASCII) that is byte order, which is what the database checks (R10).
  const sorted = [...lower].sort();
  return {
    kind: lower.length === 2 ? "dm" : "group_dm",
    key: sorted.join(","),
  };
}
