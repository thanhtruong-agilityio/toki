import { describe, expect, it } from "vitest";
import type { Db, Tx } from "../../src/db/client.js";
import {
  type EventInput,
  lockEventCounter,
  recordEvent,
} from "../../src/modules/realtime/index.js";

// What recordEvent checks before it sends a statement (TOKI-036 R15). No
// database: the transaction is a fake that records every call on it.

function fakeTx() {
  const calls: string[] = [];
  const tx = new Proxy(
    {},
    {
      get: (_target, name) => () => {
        calls.push(String(name));
        throw new Error("a statement was sent");
      },
    },
  ) as unknown as Tx;
  return { tx, calls };
}

const base = {
  workspaceId: "0190a000-0000-7000-8000-000000000001",
  type: "message.created",
  payload: {},
  at: new Date("2026-01-01T00:00:00.000Z"),
};
const ID = "0190a000-0000-7000-8000-000000000002";

describe("recordEvent: the scope and the ids (R15)", () => {
  const wrong: [string, Partial<EventInput>][] = [
    [
      "workspace with a conversation",
      { scope: "workspace", conversationId: ID },
    ],
    ["workspace with a user", { scope: "workspace", userId: ID }],
    ["conversation with no id", { scope: "conversation" }],
    [
      "conversation with a null id",
      { scope: "conversation", conversationId: null },
    ],
    [
      "conversation with a user",
      { scope: "conversation", conversationId: ID, userId: ID },
    ],
    ["user with no id", { scope: "user" }],
    [
      "user with a conversation",
      { scope: "user", userId: ID, conversationId: ID },
    ],
  ];
  it.each(wrong)("refuses %s before any statement", async (_name, over) => {
    const { tx, calls } = fakeTx();
    await expect(
      recordEvent(tx, { ...base, ...over } as EventInput),
    ).rejects.toThrow(/An event of scope/);
    expect(calls).toEqual([]);
  });

  const right: [string, Partial<EventInput>][] = [
    ["workspace", { scope: "workspace" }],
    ["conversation", { scope: "conversation", conversationId: ID }],
    ["user", { scope: "user", userId: ID }],
  ];
  it.each(right)("sends statements for a right %s event", async (_n, over) => {
    const { tx, calls } = fakeTx();
    await expect(
      recordEvent(tx, { ...base, ...over } as EventInput),
    ).rejects.toThrow("a statement was sent");
    expect(calls).toEqual(["insert"]);
  });
});

// Never run: the type checker proves that the database does not pass.
const typeOnly = (db: Db, event: EventInput) =>
  // @ts-expect-error recordEvent takes a transaction, not the database
  recordEvent(db, event);
const lockTypeOnly = (db: Db) =>
  // @ts-expect-error lockEventCounter takes a transaction, not the database
  lockEventCounter(db, "workspace");
void typeOnly;
void lockTypeOnly;
