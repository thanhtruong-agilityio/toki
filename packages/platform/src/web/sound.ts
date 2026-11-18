import type { Platform, SoundName } from "../types";

// One Audio element per name, created on the first play, so no file is
// requested before then and two copies never play at once (R20).
export function createSound(
  sounds: Partial<Record<SoundName, string>> = {},
): Platform["sound"] {
  const elements = new Map<SoundName, HTMLAudioElement>();

  return {
    async play(name) {
      try {
        const address = sounds[name];
        if (!address || typeof Audio === "undefined") return false;
        let element = elements.get(name);
        if (!element) {
          element = new Audio(address);
          elements.set(name, element);
        }
        element.currentTime = 0;
        await element.play();
        return true;
      } catch {
        return false;
      }
    },
  };
}
