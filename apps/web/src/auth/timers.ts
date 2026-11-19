// What wakes the app up: `after(ms, fn)` calls `fn` once after `ms` milliseconds and returns the way
// to cancel it (the shape of `timers` of TOKI-032 R25). The one place of apps/web that calls a global
// timer; TOKI-032's `apps/web/src/client.ts` replaces it (plan, steps 7).
export type Timers = {
  after(ms: number, fn: () => void): () => void;
};

export const timers: Timers = {
  after(ms, fn) {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};
