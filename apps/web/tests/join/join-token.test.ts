// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "Ab3-_".repeat(8) + "xyz"; // 43 base64url characters

type Win = Parameters<
  typeof import("../../src/join/join-token").captureJoinToken
>[0];

function windowAt(path: string, search = "", hash = "") {
  const replaceState = vi.fn();
  const win = {
    location: { pathname: path, search, hash },
    history: { state: { key: "router-state" }, replaceState },
  };
  return { win: win as unknown as Win, replaceState };
}

let mod: typeof import("../../src/join/join-token");
beforeEach(async () => {
  vi.resetModules();
  mod = await import("../../src/join/join-token");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the token of the Join link (R26, R43, R48)", () => {
  it("takes a valid fragment, holds it in memory and removes the fragment from the address and the history entry", () => {
    const { win, replaceState } = windowAt("/join", "", `#${TOKEN}`);
    mod.captureJoinToken(win);
    expect(mod.getJoinToken()).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledTimes(1);
    // the history state is passed through (the router keeps its own in it); the address has no fragment
    expect(replaceState).toHaveBeenCalledWith(
      { key: "router-state" },
      "",
      "/join",
    );
  });

  it("keeps a query string of the address and drops only the fragment", () => {
    const { win, replaceState } = windowAt("/join", "?a=1", `#${TOKEN}`);
    mod.captureJoinToken(win);
    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      "",
      "/join?a=1",
    );
  });

  it("returns nothing for an address with no fragment, and does not touch the history", () => {
    const { win, replaceState } = windowAt("/join");
    mod.captureJoinToken(win);
    expect(mod.getJoinToken()).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("each bad fragment is refused and removed", async () => {
    for (const bad of [
      TOKEN.slice(0, 42),
      `${TOKEN}A`,
      `${TOKEN.slice(0, 42)}+`,
      `${TOKEN.slice(0, 42)}?`,
      "x",
    ]) {
      vi.resetModules();
      const fresh = await import("../../src/join/join-token");
      const { win, replaceState } = windowAt("/join", "", `#${bad}`);
      fresh.captureJoinToken(win);
      expect(fresh.getJoinToken(), bad).toBeNull();
      expect(replaceState).toHaveBeenCalledTimes(1);
    }
  });

  it("takes nothing from another path, and leaves its fragment for the page that owns it (the emergency link)", () => {
    const { win, replaceState } = windowAt("/emergency", "", `#${TOKEN}`);
    mod.captureJoinToken(win);
    expect(mod.getJoinToken()).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("a second call returns the same token from memory and does not read the address again (R48)", () => {
    const first = windowAt("/join", "", `#${TOKEN}`);
    mod.captureJoinToken(first.win);
    // after the fragment was removed, the address is read again: nothing there
    const second = windowAt("/join");
    mod.captureJoinToken(second.win);
    expect(mod.getJoinToken()).toBe(TOKEN);
    expect(second.replaceState).not.toHaveBeenCalled();
  });

  it("a page loaded anew has no token: a reload loses it (R48)", async () => {
    const { win } = windowAt("/join", "", `#${TOKEN}`);
    mod.captureJoinToken(win);
    vi.resetModules();
    const reloaded = await import("../../src/join/join-token");
    reloaded.captureJoinToken(windowAt("/join").win);
    expect(reloaded.getJoinToken()).toBeNull();
  });

  it("writes the token to no storage and to no console (R43)", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { win } = windowAt("/join", "", `#${TOKEN}`);
    mod.captureJoinToken(win);
    mod.getJoinToken();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
