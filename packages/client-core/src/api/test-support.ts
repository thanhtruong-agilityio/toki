// Fakes for the tests of the client and the store: a `fetch` that records its
// requests and answers what the test says, and `timers` that record the delay
// and fire on demand. No test reads the system clock.
import type { Timers } from "./client";

export type Recorded = {
  url: string;
  method: string;
  headers: Headers;
  body: string | undefined;
  credentials: string | undefined;
  signal: AbortSignal | null | undefined;
};

export type Answer =
  | Response
  | Error
  | "never" // never answers
  | ((record: Recorded) => Response | Promise<Response>);

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fakeFetch(answers: Answer[] | Answer = []) {
  const queue = Array.isArray(answers) ? [...answers] : undefined;
  const single = Array.isArray(answers) ? undefined : answers;
  const calls: Recorded[] = [];
  const fn = ((input: unknown, init?: RequestInit) => {
    const record: Recorded = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
      credentials: init?.credentials,
      signal: init?.signal,
    };
    calls.push(record);
    const next = queue ? queue.shift() : single;
    if (next === undefined) {
      return Promise.reject(new Error("fakeFetch: no answer queued"));
    }
    if (next === "never") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    }
    if (next instanceof Error) return Promise.reject(next);
    if (typeof next === "function") return Promise.resolve(next(record));
    return Promise.resolve(next);
  }) as unknown as typeof fetch;
  return Object.assign(fn, { calls });
}

export function fakeTimers() {
  const pending: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  const timers: Timers = {
    after(ms, fn) {
      const entry = { ms, fn, cancelled: false };
      pending.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  };
  return {
    timers,
    delays: () => pending.map((p) => p.ms),
    cancels: () => pending.filter((p) => p.cancelled).length,
    // Fires the nth timer, if it was not cancelled.
    fire(n = pending.length - 1) {
      const entry = pending[n];
      if (entry && !entry.cancelled) entry.fn();
    },
  };
}
