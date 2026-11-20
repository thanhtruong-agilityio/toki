import { getSessionState, markSignedOut } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import { useToasts } from "@toki/ui-web";
import { useRouter } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useOnlineGate } from "../patterns/useOnlineGate";
import { conversations, sessions, timers } from "../client";

// Sign out on this device (R7 to R9, R12). The order is the contract: the
// tasks others ask for run while the session is still valid, then the call,
// and only when it succeeded the other tabs are told, the store is emptied and
// the state is set, last, so this tab changes only when everything is done. A
// failed call leaves the person signed in.

export type SignOutResult = "done" | "failed" | "blocked" | "busy";

// The running flag is one value for the whole app, not one per hook instance:
// the menu, the More sheet and a test that calls the hook twice see one sign-out.
let running = false;
const listeners = new Set<() => void>();
function setRunning(value: boolean) {
  if (running === value) return;
  running = value;
  for (const listener of [...listeners]) listener();
}
export const isSigningOut = () => running;
export function subscribeSigningOut(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useSigningOut(): boolean {
  return useSyncExternalStore(subscribeSigningOut, isSigningOut, () => false);
}

// R8: tasks that other tickets ask to run before the call (drafts, the push
// registration). Nothing is registered by this ticket.
type Task = () => void | Promise<void>;
const tasks = new Set<Task>();
export function registerBeforeSignOut(task: Task): () => void {
  tasks.add(task);
  return () => {
    tasks.delete(task);
  };
}

const TASKS_LIMIT_MS = 10_000;

type Timers = { after(ms: number, fn: () => void): () => void };

// Runs the tasks together, each started once, and ends when all have settled
// or after 10 000 ms, whichever is first. A task that throws, rejects or is
// still running never stops the sign-out. The limit is counted with the
// timers of the app, not with `setTimeout`.
async function runTasks(timersOf: Timers): Promise<void> {
  const list = [...tasks];
  if (list.length === 0) return;
  await new Promise<void>((resolve) => {
    const cancel = timersOf.after(TASKS_LIMIT_MS, resolve);
    void Promise.allSettled(
      list.map((task) => Promise.resolve().then(() => task())),
    ).then(() => {
      cancel();
      resolve();
    });
  });
}

export type SignOutDeps = {
  ensureOnline: () => boolean;
  callSignOut: () => Promise<void>;
  timers: Timers;
  // Tells the other tabs of the browser (R10).
  signal: () => void;
  // The end of the local session: reset the store, set `signedOut`, go to /login.
  end: () => void;
  toast: (text: string) => void;
  failedText: string;
  sessionStatus: () => string;
};

// The sign-out function over its dependencies; the hook wires the real ones.
export function createSignOut(deps: SignOutDeps): () => Promise<SignOutResult> {
  return async () => {
    // (1) one sign-out at a time (D-111)
    if (running) return "busy";
    // (2) offline: the helper has explained, nothing else happens (D-079)
    if (!deps.ensureOnline()) return "blocked";
    // (3) the flag and the tasks
    setRunning(true);
    try {
      await runTasks(deps.timers);
      // (4) the call
      try {
        await deps.callSignOut();
      } catch {
        // (6) the call failed. When another tab has meanwhile ended this tab
        // the person is signed out already: no toast for a failure that no
        // longer matters.
        if (deps.sessionStatus() !== "signedIn") return "done";
        deps.toast(deps.failedText);
        return "failed";
      }
      // (5) the call succeeded; a tab signal may have ended this tab already
      if (deps.sessionStatus() === "signedIn") {
        deps.signal();
        deps.end();
      }
      return "done";
    } catch {
      return "failed";
    } finally {
      setRunning(false);
    }
  };
}

type RouterLike = { history: { replace(href: string): void } };

// R9: the one function that ends this tab's session, used by Sign out and by
// the signal of another tab. It empties the store here and does not wait for
// an effect of a layout that the state change unmounts. Safe to call twice:
// `reset()` of an empty store and `markSignedOut()` of a signed-out state do
// nothing. It clears the running flag, so a tab signal ends a sign-out wait.
export function endLocalSession(router: RouterLike): void {
  conversations.reset();
  markSignedOut();
  router.history.replace("/login");
  setRunning(false);
}

// R7. The router is read when the hook is called and used after the component
// has unmounted. The function returned is stable for a given set of values.
export function useSignOut(): () => Promise<SignOutResult> {
  const router = useRouter();
  const toasts = useToasts();
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();
  return createSignOut({
    ensureOnline: () => ensureOnline(),
    callSignOut: () => sessions.signOut(),
    timers,
    signal: () => getPlatform().tabs.post({ type: "signedOut" }),
    end: () => endLocalSession(router),
    toast: (text) => void toasts.show({ text }),
    failedText: t("common.error.actionFailed"),
    sessionStatus: () => getSessionState().status,
  });
}
