import type { BootstrapPerson } from "@toki/shared";

// The people the Add dialog offers (R6): active, not yet in the channel, not the signed-in person,
// in the store's order. The list is the store's; no route lists people for a Member.
export function candidatesFor({
  people,
  memberIds,
  userId,
}: {
  people: readonly BootstrapPerson[];
  memberIds: readonly string[];
  userId: string | undefined;
}): BootstrapPerson[] {
  const members = new Set(memberIds);
  return people.filter(
    (p) => p.status === "active" && !members.has(p.id) && p.id !== userId,
  );
}
