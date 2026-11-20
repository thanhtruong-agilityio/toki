import { describe, expect, test, vi } from "vitest";
import { createTimers, type TimerHost } from "../src/timers";

// A host that records its calls, so no fake timers of the test runner are used.
function recordingHost() {
  const calls: { name: string; args: unknown[] }[] = [];
  const host: TimerHost = {
    setTimeout(fn, ms) {
      calls.push({ name: "setTimeout", args: [fn, ms] });
      return "handle-1";
    },
    clearTimeout(handle) {
      calls.push({ name: "clearTimeout", args: [handle] });
    },
  };
  return { host, calls };
}

describe("createTimers (TOKI-032 R25)", () => {
  test("after(ms, fn) calls host.setTimeout with ms and a callback that calls fn", () => {
    const { host, calls } = recordingHost();
    const fn = vi.fn();
    createTimers(host).after(10, fn);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe("setTimeout");
    expect(calls[0]!.args[1]).toBe(10);
    expect(fn).not.toHaveBeenCalled();
    (calls[0]!.args[0] as () => void)();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("the returned function calls host.clearTimeout with the same handle", () => {
    const { host, calls } = recordingHost();
    const cancel = createTimers(host).after(10, () => {});
    cancel();
    expect(calls[1]).toEqual({ name: "clearTimeout", args: ["handle-1"] });
  });

  test("defaults to the global timer functions", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createTimers().after(50, fn);
      vi.advanceTimersByTime(49);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
      const cancelled = vi.fn();
      createTimers().after(50, cancelled)();
      vi.advanceTimersByTime(100);
      expect(cancelled).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
