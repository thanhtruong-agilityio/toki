import type { BootstrapConversation, BootstrapPerson } from "@toki/shared";

// One collator for every name (TOKI-032 R18): it ignores case and keeps
// accents, so `Anh` and `Ánh` are different and ordered, not left to the id.
const collator = new Intl.Collator("vi", { sensitivity: "accent" });

// A tie is broken by id in code-point order, so the order is the same on every
// run.
export function compareByName(
  a: { name: string; id: string },
  b: { name: string; id: string },
): number {
  const byName = collator.compare(a.name, b.name);
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type PeopleById = Readonly<Record<string, BootstrapPerson>>;

// The text a row shows (R17): the name of a channel; for a dm the displayName
// of the other person; for a group the displayName of every other member,
// ordered by the collator and joined with ", ". Full names: the first load
// carries no short name. A person who is not in `people` adds no part; with
// nobody known the name is "".
export function conversationName(
  entry: BootstrapConversation,
  userId: string | undefined,
  people: PeopleById,
): string {
  if (entry.kind === "channel") return entry.name;
  const names = entry.memberIds
    .filter((memberId) => memberId !== userId)
    .map((memberId) => people[memberId]?.displayName)
    .filter((name): name is string => name !== undefined);
  if (entry.kind === "dm") return names[0] ?? "";
  return [...names].sort((a, b) => collator.compare(a, b)).join(", ");
}
