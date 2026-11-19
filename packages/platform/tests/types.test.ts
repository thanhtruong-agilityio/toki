import { describe, expect, test } from "vitest";
import type {
  NotificationPermissionState,
  PickedFile,
  Platform,
  SoundName,
  StorageArea,
} from "../src/index";
import { createWebPlatform } from "../src/web/index";

// Type-level: `pnpm typecheck` fails when a name is missing or its shape moves.
type Members = keyof Platform;
const members: Members[] = ["notifications", "storage", "files", "sound"];
const states: NotificationPermissionState[] = [
  "unsupported",
  "default",
  "granted",
  "denied",
];
const sound: SoundName = "notification";
const file: PickedFile = {
  name: "a",
  size: 1,
  mimeType: "text/plain",
  handle: null,
};
const area: Pick<StorageArea, "get" | "set" | "remove" | "clear"> | null = null;

// R3: assignable with no cast; `pnpm typecheck` fails when the shapes drift.
const web: Platform = createWebPlatform();

describe("the interface types (R1)", () => {
  test("Platform has exactly four members", () => {
    // The list above is typed against keyof Platform: a fifth member makes
    // this assertion the place to update (TOKI-099 adds `tabs`).
    const all: Record<Members, true> = {
      notifications: true,
      storage: true,
      files: true,
      sound: true,
    };
    expect(Object.keys(web).sort()).toEqual([...members].sort());
    expect(Object.keys(all).sort()).toEqual([...members].sort());
    expect([states.length, sound, file.name, area]).toEqual([
      4,
      "notification",
      "a",
      null,
    ]);
  });
});
