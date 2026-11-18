import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSound } from "./sound";

type Fake = {
  src: string;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
};
let created: Fake[];
let outcome: () => Promise<void>;

beforeEach(() => {
  created = [];
  outcome = () => Promise.resolve();
  vi.stubGlobal(
    "Audio",
    class {
      src: string;
      currentTime = 0;
      play = vi.fn(() => outcome());
      constructor(src: string) {
        this.src = src;
        created.push(this as unknown as Fake);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sound.play", () => {
  test("plays the file given for the name and resolves true (R18)", async () => {
    const sound = createSound({ notification: "/made-up.mp3" });
    await expect(sound.play("notification")).resolves.toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]?.src).toBe("/made-up.mp3");
    expect(created[0]?.play).toHaveBeenCalledTimes(1);
  });

  test("resolves false when the browser refuses or the file fails (R19)", async () => {
    outcome = () => Promise.reject(new Error("NotAllowedError"));
    const sound = createSound({ notification: "/made-up.mp3" });
    await expect(sound.play("notification")).resolves.toBe(false);
  });

  test("resolves false when play throws (R19)", async () => {
    const sound = createSound({ notification: "/made-up.mp3" });
    outcome = () => {
      throw new Error("no");
    };
    await expect(sound.play("notification")).resolves.toBe(false);
  });

  test("resolves false with no address for the name, and creates nothing (R19)", async () => {
    await expect(createSound().play("notification")).resolves.toBe(false);
    await expect(createSound({}).play("notification")).resolves.toBe(false);
    expect(created).toHaveLength(0);
  });

  test("resolves false when the browser has no Audio object (R19)", async () => {
    vi.stubGlobal("Audio", undefined);
    const sound = createSound({ notification: "/made-up.mp3" });
    await expect(sound.play("notification")).resolves.toBe(false);
  });

  test("requests no file before the first play (R20)", () => {
    createSound({ notification: "/made-up.mp3" });
    expect(created).toHaveLength(0);
  });

  test("a second play restarts the same element: one copy only (R20)", async () => {
    const sound = createSound({ notification: "/made-up.mp3" });
    await sound.play("notification");
    created[0]!.currentTime = 1.5;
    await sound.play("notification");
    expect(created).toHaveLength(1);
    expect(created[0]?.currentTime).toBe(0);
    expect(created[0]?.play).toHaveBeenCalledTimes(2);
  });

  test("an element whose play failed is dropped, so a later play retries with a new one", async () => {
    outcome = () => Promise.reject(new Error("load error"));
    const sound = createSound({ notification: "/made-up.mp3" });
    await expect(sound.play("notification")).resolves.toBe(false);
    outcome = () => Promise.resolve();
    await expect(sound.play("notification")).resolves.toBe(true);
    expect(created).toHaveLength(2);
  });
});
