import { describe, expect, test, vi } from "vitest";
import { restoreFlow } from "../../src/channel-archive/restoreFlow";

const failure = (kind: string) => ({ kind });

function run(restore: () => Promise<void>) {
  const calls = {
    show: vi.fn(),
    close: vi.fn(),
    onChanged: vi.fn(),
    busy: [] as boolean[],
  };
  const done = restoreFlow({
    id: "c1",
    restoreChannel: restore,
    classify: (error) => (error as { kind: string }).kind,
    show: calls.show,
    texts: { restored: "Restored #design", failed: "FAILED" },
    onChanged: calls.onChanged,
    closeDialog: calls.close,
    setBusy: (b) => calls.busy.push(b),
  });
  return { calls, done };
}

describe("restoreFlow (R19)", () => {
  test("success: one command, one plain toast, onChanged, the dialog closes", async () => {
    const restore = vi.fn(async () => {});
    const { calls, done } = run(restore);
    await done;
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith("c1");
    expect(calls.show).toHaveBeenCalledOnce();
    expect(calls.show).toHaveBeenCalledWith({ text: "Restored #design" });
    expect(calls.onChanged).toHaveBeenCalledOnce();
    expect(calls.close).toHaveBeenCalledOnce();
    expect(calls.busy).toEqual([true, false]);
  });

  test.each(["fresh_copy", "no_access"])(
    "%s: closes, one failure toast, onChanged so the list shows the server's state",
    async (kind) => {
      const { calls, done } = run(async () => {
        throw failure(kind);
      });
      await done;
      expect(calls.close).toHaveBeenCalledOnce();
      expect(calls.show).toHaveBeenCalledOnce();
      expect(calls.show).toHaveBeenCalledWith({ text: "FAILED" });
      expect(calls.onChanged).toHaveBeenCalledOnce();
    },
  );

  test.each(["unauthenticated", "ignore"])("%s: nothing here", async (kind) => {
    const { calls, done } = run(async () => {
      throw failure(kind);
    });
    await done;
    expect(calls.show).not.toHaveBeenCalled();
    expect(calls.close).not.toHaveBeenCalled();
    expect(calls.onChanged).not.toHaveBeenCalled();
  });

  test.each(["retry", "unknown"])(
    "%s: the dialog stays open, busy off, one failure toast",
    async (kind) => {
      const { calls, done } = run(async () => {
        throw failure(kind);
      });
      await done;
      expect(calls.show).toHaveBeenCalledOnce();
      expect(calls.close).not.toHaveBeenCalled();
      expect(calls.onChanged).not.toHaveBeenCalled();
      expect(calls.busy).toEqual([true, false]);
    },
  );
});
