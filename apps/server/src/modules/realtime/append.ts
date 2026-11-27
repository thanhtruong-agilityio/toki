import { sql } from "drizzle-orm";
import type { EventScope } from "@toki/shared";
import type { Tx } from "../../db/client.js";
import { eventCounters, events } from "./schema.js";

// Internal to the module (TOKI-036 R15): only recordEvent calls it, so no
// event is written without its signal.

export type EventInput = {
  workspaceId: string;
  scope: EventScope;
  conversationId?: string | null;
  userId?: string | null;
  type: string;
  payload: Record<string, unknown>;
  // The time of the change, from the clock.
  at: Date;
};

export type StoredEvent = {
  workspaceId: string;
  number: number;
  scope: EventScope;
  conversationId: string | null;
  userId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export async function appendEvent(
  tx: Tx,
  input: EventInput,
): Promise<StoredEvent> {
  const { workspaceId, scope, type, payload } = input;
  const conversationId = input.conversationId ?? null;
  const userId = input.userId ?? null;
  // Checked before any statement, so a refused event raises no counter. An
  // unknown scope with no id passes here and is refused by the table.
  if (
    (conversationId !== null) !== (scope === "conversation") ||
    (userId !== null) !== (scope === "user")
  ) {
    throw new Error(
      `An event of scope '${scope}' has the wrong conversation or user id.`,
    );
  }
  // The lock this statement takes on the counter row is held until the
  // transaction ends, so numbers become visible in order with no gap (R16).
  const [counter] = await tx
    .insert(eventCounters)
    .values({ workspaceId, lastNumber: 1 })
    .onConflictDoUpdate({
      target: eventCounters.workspaceId,
      set: { lastNumber: sql`${eventCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: eventCounters.lastNumber });
  const event: StoredEvent = {
    workspaceId,
    number: counter!.lastNumber,
    scope,
    conversationId,
    userId,
    type,
    payload,
    createdAt: input.at,
  };
  await tx.insert(events).values(event);
  return event;
}
