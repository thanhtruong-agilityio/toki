import { describe, expect, it, vi } from "vitest";
import { id } from "../api/fixtures";

// A counter on the name function: the names are worked out once per state,
// not once per query typed (R22).
const counter = vi.hoisted(() => ({ calls: 0 }));
vi.mock("./names", async (importOriginal) => {
  const original = await importOriginal<typeof import("./names")>();
  return {
    ...original,
    conversationName: (
      ...args: Parameters<typeof original.conversationName>
    ) => {
      counter.calls += 1;
      return original.conversationName(...args);
    },
  };
});

const { createConversationStore } = await import("./store");
const { body, fakeApi } = await import("./test-support");

describe("names once per state (R22)", () => {
  it("changing the query gives a new result and does not work the names out again", async () => {
    const fake = fakeApi();
    const store = createConversationStore({ api: fake.api });
    fake.answer("bootstrap", body());
    await store.load();
    store.getList();
    const afterFirst = counter.calls;
    expect(afterFirst).toBe(6);
    store.getList({ query: "a" });
    store.getList({ query: "ab" });
    store.getList({ query: "abc" });
    expect(counter.calls).toBe(afterFirst);
    store.setUnread(id(10), { count: 1, mention: false });
    store.getList();
    expect(counter.calls).toBe(afterFirst + 6);
  });
});
