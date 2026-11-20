import { DIRECT_CONVERSATION_MAX_OTHERS, type Decision } from "@toki/shared";
import { buildDmKey } from "./dm-key.js";
import type { AccountFacts } from "./deps.js";

// The pure rules of `POST /api/v1/direct-conversations` (TOKI-030 R5 to R7,
// R10). They read nothing from the database and compare no role: the
// permission function is passed in.

export type DirectPlan = {
  ok: true;
  kind: "dm" | "group_dm";
  key: string;
  // The people of the key, caller included, lower case, in byte order.
  memberIds: string[];
  // The other people, lower case, in the order of the request.
  others: string[];
};
export type DirectRefusal = {
  ok: false;
  refusal: "direct_with_self" | "group_too_large";
};

// Step 4 and 5 of R3: the caller's own id first, then the size. `userIds` is
// already checked by the body schema: UUIDs, no id twice once lower-cased.
export function planDirectConversation(
  actorId: string,
  userIds: readonly string[],
): DirectPlan | DirectRefusal {
  const actor = actorId.toLowerCase();
  const others = userIds.map((id) => id.toLowerCase());
  if (others.includes(actor)) return { ok: false, refusal: "direct_with_self" };
  if (others.length > DIRECT_CONVERSATION_MAX_OTHERS) {
    return { ok: false, refusal: "group_too_large" };
  }
  const { kind, key } = buildDmKey([actor, ...others]);
  return { ok: true, kind, key, memberIds: key.split(","), others };
}

export type PeopleCheck =
  | { kind: "ok"; deactivated: string[] }
  | { kind: "not_found" }
  // A permission function answered `unknown_role` or `fact_missing`: a bug of
  // a loader or a migration, never a quiet refusal (R4, R7).
  | { kind: "failure"; reason: string };

// R6, R7, R10. A missing id, another workspace and a person the function
// refuses are one answer, so the route cannot be used to find out who exists
// or who is a guest. A server failure wins over `not_found`. `ids` are the
// lower-case ids of the other people; the rows are what `getAccountsByIds`
// returned.
export function checkPeople(
  caller: AccountFacts,
  rows: readonly AccountFacts[],
  ids: readonly string[],
  canTakePart: (person: { id: string; role: string }) => Decision,
): PeopleCheck {
  let missing = false;
  const deactivated: string[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.workspaceId !== caller.workspaceId) {
      missing = true;
      continue;
    }
    const decision = canTakePart({ id: row.id, role: row.role });
    if (!decision.allowed) {
      if (decision.reason === "role_not_allowed") {
        missing = true;
        continue;
      }
      return { kind: "failure", reason: decision.reason };
    }
    if (row.status === "deactivated") deactivated.push(row.id);
  }
  if (missing) return { kind: "not_found" };
  return { kind: "ok", deactivated: deactivated.sort() };
}
