import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createWebPlatform } from "../../src/web/index";
import { createTabs } from "../../src/web/tabs";

// A fake BroadcastChannel: every instance of one name hears the others, never
// itself, as the real one does.
type Listener = (event: { data: unknown }) => void;
const open = new Map<string, Set<FakeChannel>>();
let created: FakeChannel[];

class FakeChannel {
  closed = false;
  onmessage: Listener | null = null;
  constructor(readonly name: string) {
    created.push(this);
    const set = open.get(name) ?? new Set();
    set.add(this);
    open.set(name, set);
  }
  postMessage(data: unknown) {
    for (const other of open.get(this.name) ?? []) {
      if (other !== this && !other.closed) other.onmessage?.({ data });
    }
  }
  close() {
    this.closed = true;
    open.get(this.name)?.delete(this);
  }
}

beforeEach(() => {
  open.clear();
  created = [];
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tabs (R10)", () => {
  test("a message posted in one tab reaches the listener of another, not the sender's", () => {
    const a = createWebPlatform().tabs;
    const b = createWebPlatform().tabs;
    const heardA = vi.fn();
    const heardB = vi.fn();
    a.subscribe(heardA);
    b.subscribe(heardB);
    a.post({ type: "signedOut" });
    expect(heardB).toHaveBeenCalledExactlyOnceWith({ type: "signedOut" });
    expect(heardA).not.toHaveBeenCalled();
  });

  test("it uses one channel named toki:tabs", () => {
    const a = createTabs();
    a.subscribe(() => {});
    a.post({ type: "signedOut" });
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("toki:tabs");
  });

  test("the function returned by subscribe stops that listener only", () => {
    const a = createTabs();
    const b = createTabs();
    const one = vi.fn();
    const two = vi.fn();
    const stop = b.subscribe(one);
    b.subscribe(two);
    stop();
    a.post({ type: "signedOut" });
    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledTimes(1);
  });

  test("the channel is closed when the last listener has gone", () => {
    const b = createTabs();
    const stopOne = b.subscribe(() => {});
    const stopTwo = b.subscribe(() => {});
    stopOne();
    expect(created[0].closed).toBe(false);
    stopTwo();
    expect(created[0].closed).toBe(true);
  });

  test("a message with another shape is dropped before a listener", () => {
    const b = createTabs();
    const heard = vi.fn();
    b.subscribe(heard);
    const raw = new FakeChannel("toki:tabs");
    for (const data of [
      { type: "other" },
      "signedOut",
      null,
      undefined,
      42,
      {},
    ]) {
      raw.postMessage(data);
    }
    expect(heard).not.toHaveBeenCalled();
  });

  test("a message is delivered as exactly { type } and carries nothing else", () => {
    const b = createTabs();
    const heard = vi.fn();
    b.subscribe(heard);
    new FakeChannel("toki:tabs").postMessage({
      type: "signedOut",
      address: "/c/secret",
    });
    expect(heard).toHaveBeenCalledExactlyOnceWith({ type: "signedOut" });
  });

  test("a listener that throws does not stop the others", () => {
    const b = createTabs();
    const heard = vi.fn();
    b.subscribe(() => {
      throw new Error("boom");
    });
    b.subscribe(heard);
    new FakeChannel("toki:tabs").postMessage({ type: "signedOut" });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  test("where BroadcastChannel is absent post does nothing and subscribe returns a no-op", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const tabs = createTabs();
    expect(() => tabs.post({ type: "signedOut" })).not.toThrow();
    const stop = tabs.subscribe(() => {});
    expect(() => stop()).not.toThrow();
  });

  test("where BroadcastChannel throws, no method throws", () => {
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        constructor() {
          throw new Error("denied");
        }
      },
    );
    const tabs = createTabs();
    expect(() => tabs.post({ type: "signedOut" })).not.toThrow();
    const stop = tabs.subscribe(() => {});
    expect(() => stop()).not.toThrow();
  });

  test("a post with no listener opens a channel and closes it again", async () => {
    const a = createTabs();
    const b = createTabs();
    const heard = vi.fn();
    b.subscribe(heard);
    a.post({ type: "signedOut" });
    await Promise.resolve();
    expect(heard).toHaveBeenCalledTimes(1);
    const sender = created.find((c) => c !== created[0]);
    expect(sender?.closed).toBe(true);
  });
});
