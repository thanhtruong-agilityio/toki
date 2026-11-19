import {
  CODE_IP_REQUESTS_MAX,
  CODE_REQUESTS_WINDOW_SECONDS,
  type Clock,
} from "@toki/shared";

const WINDOW_MS = CODE_REQUESTS_WINDOW_SECONDS * 1000;
const SWEEP_EVERY = 500;

// R56: at most CODE_IP_REQUESTS_MAX requests in the window for one key (route
// and network address). Every request that reaches it is counted; one the
// limit refuses leaves no entry, so a client that waits is accepted. The
// counter lives in this process: a restart empties it (accepted for M2).
export function createAddressLimiter(clock: Clock) {
  const entries = new Map<string, number[]>();
  let calls = 0;

  function sweep(now: number) {
    for (const [key, times] of entries) {
      const live = times.filter((t) => now - t < WINDOW_MS);
      if (live.length === 0) entries.delete(key);
      else entries.set(key, live);
    }
  }

  return {
    // Returns null when the request is accepted, else the whole seconds to wait.
    hit(key: string): number | null {
      const now = clock.now();
      if (++calls % SWEEP_EVERY === 0) sweep(now);
      const live = (entries.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
      if (live.length >= CODE_IP_REQUESTS_MAX) {
        entries.set(key, live);
        return Math.max(1, Math.ceil((live[0]! + WINDOW_MS - now) / 1000));
      }
      live.push(now);
      entries.set(key, live);
      return null;
    },
    size: () => entries.size,
  };
}
