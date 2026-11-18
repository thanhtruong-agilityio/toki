import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 719px)";

function media(): MediaQueryList | null {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;
}

function subscribe(notify: () => void): () => void {
  const list = media();
  if (!list) return () => {};
  list.addEventListener("change", notify);
  return () => list.removeEventListener("change", notify);
}

const snapshot = (): boolean => media()?.matches ?? false;
const serverSnapshot = (): boolean => false;

// Whether the window is 719 px wide or less; false when `matchMedia` is missing
// (R29).
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
