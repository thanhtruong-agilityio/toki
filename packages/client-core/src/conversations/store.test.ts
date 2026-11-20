import { describe, expect, it } from "vitest";
import { detailBody, id } from "../api/fixtures";
import { createConversationStore } from "./store";
import { body, deferred, fakeApi, flush, httpError } from "./test-support";

const make = () => {
  const fake = fakeApi();
  const store = createConversationStore({ api: fake.api });
  const seen: ReturnType<typeof store.getState>[] = [];
  store.subscribe(() => seen.push(store.getState()));
  return { fake, store, seen };
};

describe("state, first load and refresh (R10)", () => {
  it("starts idle, empty, not refreshing", () => {
    const { store } = make();
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.isRefreshing).toBe(false);
    expect(state.error).toBeNull();
    expect(state.user).toBeNull();
    expect(state.workspace).toBeNull();
    expect(state.people).toEqual({});
    expect(state.conversations).toEqual({});
    expect(state.details).toEqual({});
    expect(state.unread).toEqual({});
    expect(state.eventNumber).toBe(0);
  });

  it("goes idle, loading, ready, and holds exactly the answer", async () => {
    const { fake, store, seen } = make();
    fake.answer("bootstrap", body());
    const promise = store.load();
    expect(store.getState().status).toBe("loading");
    await promise;
    const state = store.getState();
    expect(seen.map((s) => s.status)).toEqual(["loading", "ready"]);
    expect(Object.keys(state.conversations)).toHaveLength(6);
    expect(Object.keys(state.people)).toEqual([id(1), id(2), id(3), id(4)]);
    expect(state.eventNumber).toBe(41);
    expect(state.user?.email).toBe("ada@example.com");
    expect(state.workspace).toEqual({ id: id(90), name: "Acme" });
    expect(state.error).toBeNull();
    expect(state.isRefreshing).toBe(false);
  });

  it("gives one request and one promise for two calls in a row, and load and refresh are the same function", async () => {
    const { fake, store } = make();
    expect(store.refresh).toBe(store.load);
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const a = store.load();
    const b = store.load();
    expect(a).toBe(b);
    gate.resolve(body());
    await a;
    expect(fake.count("bootstrap")).toBe(1);
  });

  it("never rejects: a failed first load gives failed, the error and a resolved promise", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", httpError(500));
    await expect(store.load()).resolves.toBeUndefined();
    expect(store.getState().status).toBe("failed");
    expect(store.getState().error?.status).toBe(500);
    // Retry: loading again, then ready with no error.
    fake.answer("bootstrap", body());
    const retry = store.load();
    expect(store.getState().status).toBe("loading");
    await retry;
    expect(store.getState().status).toBe("ready");
    expect(store.getState().error).toBeNull();
  });

  it("a refresh keeps ready and the list at every moment, and sets isRefreshing while it runs", async () => {
    const { fake, store, seen } = make();
    fake.answer("bootstrap", body());
    await store.load();
    const listBefore = store.getState().conversations;
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const refreshing = store.refresh();
    expect(store.getState().status).toBe("ready");
    expect(store.getState().isRefreshing).toBe(true);
    expect(store.getState().conversations).toBe(listBefore);
    gate.resolve(body((b) => (b.eventNumber = 50)));
    await refreshing;
    for (const state of seen.slice(1)) expect(state.status).toBe("ready");
    expect(store.getState().isRefreshing).toBe(false);
    expect(store.getState().eventNumber).toBe(50);
  });

  it("a failed refresh keeps the data and ready and sets the error; a good load clears it", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", body(), new Error("offline"), body());
    await store.load();
    const before = store.getState().conversations;
    await store.refresh();
    const state = store.getState();
    expect(state.status).toBe("ready");
    expect(state.isRefreshing).toBe(false);
    expect(state.error).not.toBeNull();
    expect(state.conversations).toBe(before);
    await store.refresh();
    expect(store.getState().error).toBeNull();
  });

  it("replaces the list on a refresh, and getEventNumber follows the load", async () => {
    const { fake, store } = make();
    fake.answer(
      "bootstrap",
      body(),
      body((b) => {
        b.conversations = b.conversations.slice(0, 2);
        b.eventNumber = 60;
      }),
    );
    await store.load();
    expect(store.getEventNumber()).toBe(41);
    await store.refresh();
    expect(Object.keys(store.getState().conversations)).toHaveLength(2);
    expect(store.getEventNumber()).toBe(60);
  });

  it("sends the signal of its request to api.bootstrap", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", body());
    await store.load();
    expect(fake.calls[0]!.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("subscription and snapshots (R12)", () => {
  it("calls each listener once per change, none for a change that changes nothing, and keeps old snapshots", async () => {
    const { fake, store, seen } = make();
    let calls = 0;
    const stop = store.subscribe(() => calls++);
    fake.answer("bootstrap", body());
    await store.load();
    expect(calls).toBe(2); // loading, ready
    const kept = store.getState();
    const keptCopy = JSON.stringify(kept);

    const detail = detailBody(11);
    fake.answer(
      "channels.join",
      { channel: detail, changed: true },
      { channel: detail, changed: true },
    );
    await store.joinChannel(id(11));
    const afterFirst = calls;
    await store.joinChannel(id(11)); // same entry and detail: no change
    expect(calls).toBe(afterFirst);
    // A snapshot given out is not altered by later changes (conversations and
    // details both changed by the join).
    expect(JSON.stringify(kept)).toBe(keptCopy);
    expect(store.getState()).not.toBe(kept);
    expect(Object.keys(store.getState().details)).toContain(id(11));
    expect(store.getState()).toBe(store.getState());

    stop();
    store.reset();
    expect(calls).toBe(afterFirst);
    expect(seen.length).toBeGreaterThan(0);
  });

  it("returns the same object twice with no change in between", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", body());
    await store.load();
    expect(store.getState()).toBe(store.getState());
    await flush();
  });
});
