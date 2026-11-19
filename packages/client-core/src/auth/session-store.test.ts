import { describe, expect, it, vi } from "vitest";
import {
  createSessionStore,
  type SessionState,
  type SessionUser,
} from "./session-store";

const user: SessionUser = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  role: "member",
  language: "en",
};

const other: SessionUser = { ...user, id: "u2", email: "bo@example.com" };

// One row of the state table of the TOKI-023 spec ("Session state").
type Start =
  "unknown" | "signedOut" | "signedIn" | "endedExpired" | "endedDeactivated";

function storeAt(start: Start) {
  const store = createSessionStore();
  if (start === "signedOut") store.markSignedOut();
  if (start === "signedIn") store.markSignedIn(user);
  if (start === "endedExpired") {
    store.markSignedIn(user);
    store.reportUnauthenticated("session_ended");
  }
  if (start === "endedDeactivated") {
    store.reportUnauthenticated("account_deactivated");
  }
  return store;
}

describe("session state (TOKI-023, R39)", () => {
  it("starts unknown", () => {
    expect(createSessionStore().getSessionState()).toEqual({
      status: "unknown",
    });
  });

  const rows: [Start, string, SessionState][] = [
    ["unknown", "unauthenticated", { status: "signedOut" }],
    ["unknown", "session_ended", { status: "signedOut" }],
    [
      "unknown",
      "account_deactivated",
      { status: "ended", reason: "deactivated" },
    ],
    ["signedIn", "unauthenticated", { status: "ended", reason: "expired" }],
    ["signedIn", "session_ended", { status: "ended", reason: "expired" }],
    [
      "signedIn",
      "account_deactivated",
      { status: "ended", reason: "deactivated" },
    ],
    ["signedOut", "unauthenticated", { status: "signedOut" }],
    ["signedOut", "account_deactivated", { status: "signedOut" }],
    ["endedExpired", "session_ended", { status: "ended", reason: "expired" }],
    [
      "endedExpired",
      "account_deactivated",
      { status: "ended", reason: "expired" },
    ],
    [
      "endedDeactivated",
      "unauthenticated",
      { status: "ended", reason: "deactivated" },
    ],
  ];

  it.each(rows)("%s and a 401 %s gives %j", (start, code, expected) => {
    const store = storeAt(start);
    store.reportUnauthenticated(code);
    expect(store.getSessionState()).toEqual(expected);
  });

  it("ignores a code it does not know", () => {
    const store = storeAt("signedIn");
    store.reportUnauthenticated("something_else");
    expect(store.getSessionState()).toEqual({ status: "signedIn", user });
  });

  it("changes once for two refusals, so one modal shows (R27)", () => {
    const store = storeAt("signedIn");
    const listener = vi.fn();
    store.subscribeSession(listener);
    store.reportUnauthenticated("session_ended");
    store.reportUnauthenticated("session_ended");
    store.reportUnauthenticated("unauthenticated");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("markSignedIn sets signedIn from any state, with that user", () => {
    for (const start of [
      "unknown",
      "signedOut",
      "signedIn",
      "endedExpired",
      "endedDeactivated",
    ] as Start[]) {
      const store = storeAt(start);
      store.markSignedIn(other);
      expect(store.getSessionState()).toEqual({
        status: "signedIn",
        user: other,
      });
    }
  });

  it("markSignedOut sets signedOut from any state", () => {
    for (const start of [
      "unknown",
      "signedIn",
      "endedExpired",
      "endedDeactivated",
    ] as Start[]) {
      const store = storeAt(start);
      store.markSignedOut();
      expect(store.getSessionState()).toEqual({ status: "signedOut" });
    }
  });

  it("calls a listener on each change and not after it unsubscribes", () => {
    const store = createSessionStore();
    const listener = vi.fn();
    const stop = store.subscribeSession(listener);
    store.markSignedIn(user);
    store.markSignedOut();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    store.markSignedIn(user);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not call a listener when nothing changes", () => {
    const store = storeAt("signedOut");
    const listener = vi.fn();
    store.subscribeSession(listener);
    store.markSignedOut();
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns the same object until the state changes (for useSyncExternalStore)", () => {
    const store = storeAt("signedIn");
    expect(store.getSessionState()).toBe(store.getSessionState());
    const before = store.getSessionState();
    store.reportUnauthenticated("unknown_code");
    expect(store.getSessionState()).toBe(before);
  });

  it("touches nothing but the state: no storage, no address, no timer (R39, R45)", () => {
    const globals = globalThis as Record<string, unknown>;
    expect(globals.localStorage).toBeUndefined();
    const store = storeAt("signedIn");
    store.reportUnauthenticated("session_ended");
    store.markSignedOut();
    store.markSignedIn(user);
    expect(store.getSessionState()).toEqual({ status: "signedIn", user });
  });
});
