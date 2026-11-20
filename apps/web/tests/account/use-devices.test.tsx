// @vitest-environment jsdom
import type { SessionItem } from "@toki/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { sessions } from "../../src/client";
import { useSignedInDevices } from "../../src/account/use-devices";

const item = (id: string): SessionItem => ({
  id,
  current: id === "me",
  deviceKind: "desktop",
  browser: "chrome",
  lastUsedAt: "2026-11-16T09:00:00Z",
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
afterEach(() => vi.restoreAllMocks());

describe("useSignedInDevices (R14)", () => {
  test("loading, then ready with the list", async () => {
    const first = deferred<SessionItem[]>();
    vi.spyOn(sessions, "list").mockReturnValue(first.promise);
    const { result } = renderHook(() => useSignedInDevices());
    expect(result.current.status).toBe("loading");
    await act(async () => first.resolve([item("me")]));
    expect(result.current.status).toBe("ready");
    expect(result.current.devices.map((d) => d.id)).toEqual(["me"]);
    expect(result.current.refreshing).toBe(false);
  });

  test("two overlapping reads where the first answers last: the newer list stays", async () => {
    const first = deferred<SessionItem[]>();
    const second = deferred<SessionItem[]>();
    vi.spyOn(sessions, "list")
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSignedInDevices());
    let reloaded: SessionItem[] | null = [];
    act(() => {
      void result.current.reload().then((l) => (reloaded = l));
    });
    await act(async () => second.resolve([item("me"), item("new")]));
    await act(async () => first.resolve([item("old")]));
    expect(result.current.devices.map((d) => d.id)).toEqual(["me", "new"]);
    expect(reloaded).toEqual([item("me"), item("new")]);
  });

  test("a failed reload keeps the held list and flags the error; the answer is null", async () => {
    vi.spyOn(sessions, "list")
      .mockResolvedValueOnce([item("me")])
      .mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useSignedInDevices());
    await act(async () => {});
    let answer: SessionItem[] | null = [];
    await act(async () => {
      answer = await result.current.reload();
    });
    expect(answer).toBeNull();
    expect(result.current.status).toBe("failed");
    expect(result.current.devices.map((d) => d.id)).toEqual(["me"]);
    expect(result.current.held).toBe(true);
  });

  test("an answer after unmount changes nothing and does not throw", async () => {
    const first = deferred<SessionItem[]>();
    vi.spyOn(sessions, "list").mockReturnValue(first.promise);
    const { unmount } = renderHook(() => useSignedInDevices());
    unmount();
    await act(async () => first.resolve([item("me")]));
  });
});
