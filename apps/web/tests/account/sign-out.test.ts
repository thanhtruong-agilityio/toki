import { getSessionState, markSignedIn } from "@toki/client-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { conversations } from "../../src/client";
import {
  createSignOut,
  endLocalSession,
  isSigningOut,
  registerBeforeSignOut,
  subscribeSigningOut,
  type SignOutDeps,
} from "../../src/account/sign-out";

// A recording timers of the form TOKI-032 uses: no Vitest fake time (TOKI-008 R19).
function fakeTimers() {
  const pending: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  return {
    timers: {
      after(ms: number, fn: () => void) {
        const entry = { ms, fn, cancelled: false };
        pending.push(entry);
        return () => {
          entry.cancelled = true;
        };
      },
    },
    delays: () => pending.map((p) => p.ms),
    fire: (n = pending.length - 1) => {
      const e = pending[n];
      if (e && !e.cancelled) e.fn();
    },
  };
}

type Setup = {
  calls: string[];
  deps: SignOutDeps;
  timers: ReturnType<typeof fakeTimers>;
  api: { release: () => void; fail: (e: unknown) => void };
};

function setup(
  over: Partial<SignOutDeps> = {},
  state: () => string = () => "signedIn",
  immediate = true,
): Setup {
  const calls: string[] = [];
  const timers = fakeTimers();
  let release = () => {};
  let fail: (e: unknown) => void = () => {};
  const deps: SignOutDeps = {
    ensureOnline: () => true,
    callSignOut: () => {
      calls.push("api");
      if (immediate) return Promise.resolve();
      return new Promise<void>((res, rej) => {
        release = res;
        fail = rej;
      });
    },
    timers: timers.timers,
    signal: () => calls.push("signal"),
    end: () => calls.push("end"),
    toast: (text) => calls.push(`toast:${text}`),
    failedText: "FAILED",
    sessionStatus: state,
    ...over,
  };
  return {
    calls,
    deps,
    timers,
    api: { release: () => release(), fail: (e) => fail(e) },
  };
}

const stops: Array<() => void> = [];
afterEach(() => {
  while (stops.length) stops.pop()!();
});
const reg = (task: () => void | Promise<void>) => {
  const stop = registerBeforeSignOut(task);
  stops.push(stop);
  return stop;
};

describe("sign out, the six paths (R7)", () => {
  test("done: the call, then the signal, then the end of the local session, in this order", async () => {
    const s = setup();
    const result = await createSignOut(s.deps)();
    expect(result).toBe("done");
    expect(s.calls).toEqual(["api", "signal", "end"]);
    expect(isSigningOut()).toBe(false);
  });

  test("blocked: offline calls nothing else and does not set the flag", async () => {
    const s = setup({ ensureOnline: () => false });
    const result = await createSignOut(s.deps)();
    expect(result).toBe("blocked");
    expect(s.calls).toEqual([]);
    expect(isSigningOut()).toBe(false);
  });

  test("failed: the flag is cleared, one toast, no signal and no end", async () => {
    for (const error of [
      Object.assign(new Error("n"), { kind: "network" }),
      Object.assign(new Error("t"), { kind: "timeout" }),
      Object.assign(new Error("h"), { kind: "http", status: 500 }),
    ]) {
      const s = setup({
        callSignOut: () => {
          s.calls.push("api");
          return Promise.reject(error);
        },
      });
      expect(await createSignOut(s.deps)()).toBe("failed");
      expect(s.calls).toEqual(["api", "toast:FAILED"]);
      expect(isSigningOut()).toBe(false);
    }
  });

  test("busy: a second call during the first returns busy and calls the API once", async () => {
    const s = setup({}, () => "signedIn", false);
    const signOut = createSignOut(s.deps);
    const first = signOut();
    expect(isSigningOut()).toBe(true);
    // a second instance of the hook's function (same module flag)
    const second = createSignOut(setup().deps);
    expect(await second()).toBe("busy");
    expect(await signOut()).toBe("busy");
    await Promise.resolve();
    await Promise.resolve();
    s.api.release();
    expect(await first).toBe("done");
    expect(s.calls.filter((c) => c === "api")).toHaveLength(1);
  });

  test("the flag notifies its subscribers when it changes", async () => {
    const seen: boolean[] = [];
    const off = subscribeSigningOut(() => seen.push(isSigningOut()));
    const s = setup();
    await createSignOut(s.deps)();
    off();
    expect(seen).toEqual([true, false]);
  });

  test("never rejects, even when a dependency throws", async () => {
    const s = setup({
      end: () => {
        throw new Error("boom");
      },
    });
    await expect(createSignOut(s.deps)()).resolves.toBe("failed");
    expect(isSigningOut()).toBe(false);
  });
});

describe("the tasks before the call (R8)", () => {
  test("the call waits for a slow task, ignores one that throws and one that is fast", async () => {
    const s = setup();
    let finishSlow = () => {};
    const ran: string[] = [];
    reg(
      () =>
        new Promise<void>((res) => {
          ran.push("slow");
          finishSlow = res;
        }),
    );
    reg(() => {
      ran.push("throws");
      throw new Error("x");
    });
    reg(async () => {
      ran.push("fast");
    });
    const pending = createSignOut(s.deps)();
    await Promise.resolve();
    await Promise.resolve();
    expect(ran.sort()).toEqual(["fast", "slow", "throws"]);
    expect(s.calls).toEqual([]);
    finishSlow();
    expect(await pending).toBe("done");
    expect(s.calls[0]).toBe("api");
  });

  test("a task that never settles releases the call at the recorded 10 000 ms timer, not before", async () => {
    const s = setup();
    reg(() => new Promise<void>(() => {}));
    const pending = createSignOut(s.deps)();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.timers.delays()).toEqual([10_000]);
    expect(s.calls).toEqual([]);
    s.timers.fire();
    expect(await pending).toBe("done");
    expect(s.calls[0]).toBe("api");
  });

  test("a task that rejects never stops the sign-out", async () => {
    const s = setup();
    reg(() => Promise.reject(new Error("no")));
    expect(await createSignOut(s.deps)()).toBe("done");
    expect(s.calls[0]).toBe("api");
  });

  test("a removed task is not run, and the timer is cancelled when the tasks settle first", async () => {
    const s = setup();
    const ran: string[] = [];
    const stop = reg(() => {
      ran.push("removed");
    });
    reg(() => {
      ran.push("kept");
    });
    stop();
    await createSignOut(s.deps)();
    expect(ran).toEqual(["kept"]);
    s.timers.fire(); // cancelled: nothing happens
  });

  test("with no task the 10 s timer is not started", async () => {
    const s = setup();
    await createSignOut(s.deps)();
    expect(s.timers.delays()).toEqual([]);
  });
});

describe("a tab signal that arrives during the call", () => {
  test("a call that finds the state already signed out is done, with no second signal, no end and no toast", async () => {
    let status = "signedIn";
    const s = setup({}, () => status, false);
    const pending = createSignOut(s.deps)();
    await Promise.resolve();
    await Promise.resolve();
    status = "signedOut"; // another tab's message ended this tab meanwhile
    s.api.release();
    expect(await pending).toBe("done");
    expect(s.calls).toEqual(["api"]);
  });

  test("a failure after the state became signed out shows no toast", async () => {
    let status = "signedIn";
    const s = setup({}, () => status, false);
    const pending = createSignOut(s.deps)();
    await Promise.resolve();
    await Promise.resolve();
    status = "signedOut";
    s.api.fail(Object.assign(new Error("401"), { kind: "http", status: 401 }));
    expect(await pending).toBe("done");
    expect(s.calls).toEqual(["api"]);
    expect(isSigningOut()).toBe(false);
  });
});

describe("the end of the local session (R9)", () => {
  test("empties the store, then sets signedOut, then replaces the address with /login, in this order", () => {
    markSignedIn({
      id: "00000000-0000-4000-8000-0000000000aa",
      email: "sam@example.com",
      displayName: "Sam",
      role: "member",
      language: "en",
    });
    const seen: string[] = [];
    vi.spyOn(conversations, "reset").mockImplementation(() => {
      seen.push(`reset:${getSessionState().status}`);
    });
    endLocalSession({
      history: {
        replace: (href: string) =>
          void seen.push(`replace:${href}:${getSessionState().status}`),
      },
    });
    expect(seen).toEqual(["reset:signedIn", "replace:/login:signedOut"]);
    vi.restoreAllMocks();
  });

  test("twice changes nothing more", () => {
    const replace = vi.fn();
    endLocalSession({ history: { replace } });
    endLocalSession({ history: { replace } });
    expect(getSessionState().status).toBe("signedOut");
  });
});
