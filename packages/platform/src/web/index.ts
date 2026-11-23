import type { Platform, SoundName } from "../types";
import { createFiles } from "./files";
import { createNotifications } from "./notifications";
import { createSound } from "./sound";
import { createStorage } from "./storage";
import { createTabs } from "./tabs";

export type WebPlatformOptions = {
  // The address of the audio file of each sound name.
  sounds?: Partial<Record<SoundName, string>>;
};

// Builds the web implementation. It touches no browser API itself: every
// access is inside a method, so calling this starts nothing (R5).
export function createWebPlatform(options: WebPlatformOptions = {}): Platform {
  return {
    notifications: createNotifications(),
    storage: createStorage(),
    files: createFiles(),
    sound: createSound(options.sounds),
    tabs: createTabs(),
  };
}
