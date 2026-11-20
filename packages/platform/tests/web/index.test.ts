import { afterEach, describe, expect, test, vi } from "vitest";
import type { Platform } from "../../src/index";
import { createWebPlatform } from "../../src/web/index";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createWebPlatform", () => {
  test("its result is assignable to Platform with no cast (R3)", () => {
    const platform: Platform = createWebPlatform();
    expect(Object.keys(platform).sort()).toEqual([
      "files",
      "notifications",
      "sound",
      "storage",
      "tabs",
    ]);
    expect(Object.keys(platform.storage).sort()).toEqual(["device", "tab"]);
  });

  test("has no visible effect and starts nothing (R5)", () => {
    const request = vi.fn();
    const audio = vi.fn();
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: request,
    });
    vi.stubGlobal("Audio", audio);
    const storage = ["setItem", "getItem", "removeItem", "clear"].map((m) =>
      vi.spyOn(Storage.prototype, m as "setItem"),
    );
    const before = document.documentElement.outerHTML;

    createWebPlatform({ sounds: { notification: "/made-up.mp3" } });

    expect(request).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    for (const spy of storage) expect(spy).not.toHaveBeenCalled();
    expect(document.documentElement.outerHTML).toBe(before);
  });

  test("passes the sound addresses to sound.play (R18)", async () => {
    const play = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      "Audio",
      class {
        play = play;
      },
    );
    const platform = createWebPlatform({ sounds: { notification: "/x.mp3" } });
    await expect(platform.sound.play("notification")).resolves.toBe(true);
  });
});
