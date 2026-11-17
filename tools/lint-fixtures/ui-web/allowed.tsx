// Fixture for rule 3: everything here is allowed (R10), so no line may be
// reported. The features are reached through the platform package.
import { audio, notifications, storage } from "@toki/platform";

export const saved = storage.get("draft");
export const ring = () => audio.play("timer-end");
export const ask = () => notifications.requestPermission();

// Browser APIs that are not platform features stay allowed in ui-web.
export const width = window.innerWidth;
export const language = navigator.language;
export const title = document.title;
export const Clip = () => <video src="a.mp4" />;

// A local name that shadows a banned global is not the global.
export function read(localStorage: { get(key: string): string }) {
  return localStorage.get("draft");
}
