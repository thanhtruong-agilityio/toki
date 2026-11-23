import { describe, expect, test, vi } from "vitest";
import {
  archiveFlow,
  readArchiveCount,
} from "../../src/channel-archive/archiveFlow";

// The count of the confirmation (R9) and what a confirmed archive does (R10, R11). Both are plain
// functions, so they are tested with stand-ins and no component.
describe("readArchiveCount (R9)", () => {
  test("the count of the fresh read, not the held one", async () => {
    const count = await readArchiveCount({
      id: "c1",
      readChannel: async () => ({ memberCount: 25 }),
      getMemberCount: () => 2,
    });
    expect(count).toBe(25);
  });
  test("a failed read falls back to the held count", async () => {
    const count = await readArchiveCount({
      id: "c1",
      readChannel: async () => {
        throw new Error("down");
      },
      getMemberCount: () => 7,
    });
    expect(count).toBe(7);
  });
  test("a failed read with no held count gives null: nothing opens", async () => {
    const count = await readArchiveCount({
      id: "c1",
      readChannel: async () => {
        throw new Error("down");
      },
      getMemberCount: () => undefined,
    });
    expect(count).toBeNull();
  });
});

type Kind = string;
const failure = (kind: Kind) => ({ kind });

function run(archive: () => Promise<void>) {
  const calls = {
    show: vi.fn(),
    close: vi.fn(),
    onNoAccess: vi.fn(),
    readChannel: vi.fn(async () => ({})),
    busy: [] as boolean[],
  };
  const done = archiveFlow({
    id: "c1",
    archiveChannel: archive,
    readChannel: calls.readChannel,
    classify: (error) => (error as { kind: Kind }).kind,
    show: calls.show,
    texts: { done: "Archived #design", failed: "FAILED" },
    onNoAccess: calls.onNoAccess,
    closeDialog: calls.close,
    setBusy: (b) => calls.busy.push(b),
  });
  return { calls, done };
}

describe("archiveFlow (R10, R11)", () => {
  test("success: one command, one plain toast, the dialog closes, busy ends", async () => {
    const archive = vi.fn(async () => {});
    const { calls, done } = run(archive);
    await done;
    expect(archive).toHaveBeenCalledOnce();
    expect(archive).toHaveBeenCalledWith("c1");
    expect(calls.show).toHaveBeenCalledOnce();
    expect(calls.show).toHaveBeenCalledWith({ text: "Archived #design" });
    expect(calls.close).toHaveBeenCalledOnce();
    expect(calls.busy).toEqual([true, false]);
  });

  test("no_access: closes the dialog, calls onNoAccess once, no toast", async () => {
    const { calls, done } = run(async () => {
      throw failure("no_access");
    });
    await done;
    expect(calls.close).toHaveBeenCalledOnce();
    expect(calls.onNoAccess).toHaveBeenCalledOnce();
    expect(calls.show).not.toHaveBeenCalled();
  });

  test("fresh_copy: reads the channel, closes, one failure toast", async () => {
    const { calls, done } = run(async () => {
      throw failure("fresh_copy");
    });
    await done;
    expect(calls.readChannel).toHaveBeenCalledWith("c1");
    expect(calls.close).toHaveBeenCalledOnce();
    expect(calls.show).toHaveBeenCalledOnce();
    expect(calls.show).toHaveBeenCalledWith({ text: "FAILED" });
    expect(calls.onNoAccess).not.toHaveBeenCalled();
  });

  test.each(["unauthenticated", "ignore"])(
    "%s: nothing here, the dialog stays",
    async (kind) => {
      const { calls, done } = run(async () => {
        throw failure(kind);
      });
      await done;
      expect(calls.show).not.toHaveBeenCalled();
      expect(calls.close).not.toHaveBeenCalled();
      expect(calls.onNoAccess).not.toHaveBeenCalled();
      expect(calls.busy).toEqual([true, false]);
    },
  );

  test.each(["retry", "unknown", "unreadable"])(
    "%s: the dialog stays open, busy off, one failure toast",
    async (kind) => {
      const { calls, done } = run(async () => {
        throw failure(kind);
      });
      await done;
      expect(calls.show).toHaveBeenCalledOnce();
      expect(calls.show).toHaveBeenCalledWith({ text: "FAILED" });
      expect(calls.close).not.toHaveBeenCalled();
      expect(calls.busy).toEqual([true, false]);
    },
  );
});
