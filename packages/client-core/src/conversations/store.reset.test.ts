import { describe, expect, it } from "vitest";
import { detailBody, id } from "../api/fixtures";
import { createConversationStore } from "./store";
import { body, deferred, fakeApi, flush } from "./test-support";

const make = () => {
  const fake = fakeApi();
  const store = createConversationStore({ api: fake.api });
  let listenerCalls = 0;
  store.subscribe(() => listenerCalls++);
  return { fake, store, calls: () => listenerCalls };
};

describe("reset and stale answers (R11)", () => {
  it("drops the whole state, so nothing of the earlier person stays", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", body());
    await store.load();
    store.reset();
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.user).toBeNull();
    expect(state.people).toEqual({});
    expect(state.conversations).toEqual({});
    expect(state.details).toEqual({});
    expect(state.unread).toEqual({});
  });

  it("ignores a first load that answers after reset, and the abandoned promise resolves", async () => {
    const { fake, store, calls } = make();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const promise = store.load();
    const before = calls();
    store.reset();
    gate.resolve(body());
    await expect(promise).resolves.toBeUndefined();
    expect(store.getState().status).toBe("idle");
    expect(store.getState().conversations).toEqual({});
    expect(calls()).toBe(before + 1); // the reset itself, once
  });

  it("ignores a refresh that answers after reset", async () => {
    const { fake, store } = make();
    fake.answer("bootstrap", body());
    await store.load();
    const gate = deferred<unknown>();
    fake.answer("bootstrap", gate);
    const promise = store.refresh();
    store.reset();
    gate.resolve(body());
    await promise;
    expect(store.getState().status).toBe("idle");
  });

  it("ignores a command that answers after reset", async () => {
    const { fake, store } = make();
    const gate = deferred<unknown>();
    fake.answer("channels.join", gate);
    const promise = store.joinChannel(id(11));
    store.reset();
    gate.resolve({ channel: detailBody(11), changed: true });
    await promise;
    expect(store.getState().conversations).toEqual({});
    expect(store.getState().details).toEqual({});
  });

  it("aborts the request in flight, and sends a second request after load, reset, load", async () => {
    const { fake, store } = make();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    fake.answer("bootstrap", first, second);
    const p1 = store.load();
    const signal = fake.calls[0]!.signal!;
    expect(signal.aborted).toBe(false);
    store.reset();
    expect(signal.aborted).toBe(true);
    const p2 = store.load();
    expect(p2).not.toBe(p1);
    expect(fake.count("bootstrap")).toBe(2);
    // The answers arrive in either order: only the second one counts.
    second.resolve(body((b) => (b.eventNumber = 2)));
    first.resolve(body((b) => (b.eventNumber = 1)));
    await Promise.all([p1, p2]);
    expect(store.getState().eventNumber).toBe(2);
  });

  it("holds the answer of the second request only when the first arrives later, and when it arrives first", async () => {
    for (const firstArrivesFirst of [true, false]) {
      const { fake, store } = make();
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      fake.answer("bootstrap", first, second);
      const p1 = store.load();
      store.reset();
      const p2 = store.load();
      const a = () => first.resolve(body((b) => (b.eventNumber = 1)));
      const b = () => second.resolve(body((x) => (x.eventNumber = 2)));
      if (firstArrivesFirst) {
        a();
        await flush();
        b();
      } else {
        b();
        await flush();
        a();
      }
      await Promise.all([p1, p2]);
      expect(store.getState().eventNumber).toBe(2);
    }
  });

  it("a reset of a store in its first state changes nothing and calls no listener, twice in a row", async () => {
    const { fake, store, calls } = make();
    const before = store.getState();
    store.reset();
    expect(store.getState()).toBe(before);
    expect(calls()).toBe(0);
    fake.answer("bootstrap", body());
    await store.load();
    const afterLoad = calls();
    store.reset();
    expect(calls()).toBe(afterLoad + 1);
    const idle = store.getState();
    store.reset();
    expect(store.getState()).toBe(idle);
    expect(calls()).toBe(afterLoad + 1);
  });

  it("a load that was reset away leaves status idle, and the reset while loading calls the listener once", async () => {
    const { fake, store, calls } = make();
    fake.answer("bootstrap", deferred());
    void store.load();
    const before = calls();
    store.reset();
    expect(store.getState().status).toBe("idle");
    expect(calls()).toBe(before + 1);
  });
});
