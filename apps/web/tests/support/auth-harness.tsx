import { act } from "@testing-library/react";
import { vi } from "vitest";
import type {
  CodeRequestOutcome,
  CodeSubmitOutcome,
  SessionReadOutcome,
  SignInCalls,
  SignInUser,
} from "@toki/client-core";

export const user: SignInUser = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  role: "member",
  language: "en",
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// What the fake calls answer. Each is a `vi.fn`, so a test reads what was sent and changes the answer.
export function createFakeCalls(
  over: Partial<{
    requestCode: SignInCalls["requestCode"];
    submitCode: SignInCalls["submitCode"];
    readSession: SignInCalls["readSession"];
    readWorkspaceName: SignInCalls["readWorkspaceName"];
  }> = {},
) {
  const requestOk: CodeRequestOutcome = {
    kind: "ok",
    requestId: "req-1",
    expiresInSeconds: 600,
    resendAfterSeconds: 60,
  };
  const requestCode = vi.fn<SignInCalls["requestCode"]>(
    over.requestCode ?? (async () => requestOk),
  );
  const submitCode = vi.fn<SignInCalls["submitCode"]>(
    over.submitCode ??
      (async () => ({ kind: "ok", user }) satisfies CodeSubmitOutcome),
  );
  const readSession = vi.fn<SignInCalls["readSession"]>(
    over.readSession ??
      (async () => ({ kind: "ok", user }) satisfies SessionReadOutcome),
  );
  const readWorkspaceName = vi.fn<SignInCalls["readWorkspaceName"]>(
    over.readWorkspaceName ?? (async () => "Acme"),
  );
  return { requestCode, submitCode, readSession, readWorkspaceName };
}

// A `timers` object the test moves by hand; `advance` moves the test clock and runs what falls due.
export function createFakeTimers(clock: {
  now(): number;
  set(n: number): void;
}) {
  type Item = { at: number; fn: () => void };
  let items: Item[] = [];
  return {
    after(ms: number, fn: () => void): () => void {
      const item = { at: clock.now() + ms, fn };
      items.push(item);
      return () => {
        items = items.filter((i) => i !== item);
      };
    },
    advance(ms: number): void {
      const target = clock.now() + ms;
      for (;;) {
        const due = items
          .filter((i) => i.at <= target)
          .sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        items = items.filter((i) => i !== due);
        clock.set(Math.max(clock.now(), due.at));
        act(() => due.fn());
      }
      clock.set(target);
      act(() => {});
    },
  };
}
