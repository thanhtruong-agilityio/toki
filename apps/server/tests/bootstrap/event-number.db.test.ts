import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildBootstrap } from "../../src/bootstrap/build.js";
import { recordEvent } from "../../src/modules/realtime/index.js";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { input } from "../realtime/helpers.js";

// The event number of the bootstrap answer comes from the event log (TOKI-036
// R19, which changes TOKI-031 R11).

let h: Harness;
let admin: string;
beforeAll(async () => {
  h = await createHarness();
  admin = await h.addUser("admin@example.com", { role: "admin" });
});
afterAll(async () => {
  await h?.close();
});

const append = () =>
  h.db.transaction((tx) => recordEvent(tx, input(h.workspaceId)));
const answered = async () =>
  (await buildBootstrap(h.db, { id: admin })).eventNumber;

describe("buildBootstrap: the event number of the log (R19)", () => {
  it("answers 0 with no event and the last number after three", async () => {
    expect(await answered()).toBe(0);
    for (let i = 0; i < 3; i += 1) await append();
    expect(await answered()).toBe(3);
  });

  it("holds the number of its snapshot", async () => {
    const before = await answered();
    const during = await buildBootstrap(
      h.db,
      { id: admin },
      {
        // Another connection commits an event after the account was read.
        afterAccount: async () => {
          await append();
        },
      },
    );
    expect(during.eventNumber).toBe(before);
    expect(await answered()).toBe(before + 1);
  });
});
