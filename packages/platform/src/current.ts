import type { Platform } from "./types";

let current: Platform | undefined;

// The app chooses its build of platform once, at start.
export function setPlatform(platform: Platform): void {
  current = platform;
}

// Components and client code reach the device only through this.
export function getPlatform(): Platform {
  if (!current) {
    throw new Error(
      "platform is not set: call setPlatform(...) before getPlatform()",
    );
  }
  return current;
}
