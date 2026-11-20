// A fake `api` for the store tests (TOKI-032 Testing): the methods of R9, each
// answering from a queue the test fills. An answer is a value (resolves), an
// Error (rejects) or a deferred the test releases later, in the order it likes.
import type { BootstrapResponse } from "@toki/shared";
import { ApiError } from "../api/errors";
import { bootstrapBody } from "../api/fixtures";
import type { StoreApi } from "./store";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Answer = unknown | Error | Deferred<unknown>;

const isDeferred = (value: unknown): value is Deferred<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "promise" in value &&
  "resolve" in value;

export function fakeApi() {
  const queues: Record<string, Answer[]> = {};
  const calls: { name: string; args: unknown[]; signal?: AbortSignal }[] = [];

  const method =
    (name: string, signalIndex?: number) =>
    (...args: unknown[]): Promise<never> => {
      const signal =
        signalIndex === undefined
          ? undefined
          : (args[signalIndex] as AbortSignal | undefined);
      calls.push({ name, args, signal });
      const queue = queues[name] ?? [];
      if (queue.length === 0) {
        return Promise.reject(new Error(`fakeApi: no answer for ${name}`));
      }
      const answer = queue.shift();
      if (answer instanceof Error) return Promise.reject(answer);
      if (isDeferred(answer)) return answer.promise as Promise<never>;
      return Promise.resolve(answer as never);
    };

  const api = {
    bootstrap: method("bootstrap", 0),
    channels: {
      create: method("channels.create"),
      get: method("channels.get"),
      join: method("channels.join"),
      update: method("channels.update"),
      leave: method("channels.leave"),
      archive: method("channels.archive"),
      restore: method("channels.restore"),
    },
    directConversations: { open: method("directConversations.open") },
    conversations: { saveSettings: method("conversations.saveSettings") },
  } as unknown as StoreApi;

  return {
    api,
    calls,
    count: (name: string) => calls.filter((c) => c.name === name).length,
    // Queue answers for a method, e.g. `fake.answer("bootstrap", body)`.
    answer(name: string, ...answers: Answer[]) {
      (queues[name] ??= []).push(...answers);
    },
  };
}

export const httpError = (status: number, code: string | null = null) =>
  new ApiError({ kind: "http", status, code });

// The rich bootstrap body, changed by `edit` on a copy.
export function body(edit?: (b: BootstrapResponse) => void): BootstrapResponse {
  const value = bootstrapBody();
  edit?.(value);
  return value;
}

// Lets the promises that are already settled run.
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
