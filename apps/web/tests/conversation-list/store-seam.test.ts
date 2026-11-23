import { describe, expect, test, vi } from "vitest";
import {
  channel,
  createStoreHarness,
  useFakeStore,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

describe("the store seam of the tests", () => {
  test("a real store loads a body and groups it", async () => {
    const h = createStoreHarness(
      workspaceBody([
        channel("g", "general", { isGeneral: true }),
        channel("s", "stars", { isStarred: true }),
      ]),
    );
    await h.loadNow();
    expect(h.store.getState().status).toBe("ready");
    const list = h.store.getList({ query: "", filter: "all" });
    expect(list.channels.map((r) => r.name)).toEqual(["general"]);
    expect(list.starred.map((r) => r.name)).toEqual(["stars"]);
    expect(h.store.getList({ query: "", filter: "all" })).toBe(list);
  });

  test("the mocked client hands the store of the running test to the app", async () => {
    const h = useFakeStore(workspaceBody([channel("g", "general")]));
    const { conversations } = await import("../../src/client");
    await conversations.load();
    expect(h.bootstrapCalls()).toBe(1);
    expect(conversations.hasConversation("g")).toBe(true);
    expect(h.store.hasConversation("g")).toBe(true);
  });
});
