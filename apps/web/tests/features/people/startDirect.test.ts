import { ErrorCodes } from "@toki/shared";
import { ApiError } from "@toki/client-core";
import { describe, expect, test, vi } from "vitest";
import { startDirect } from "../../../src/features/people/startDirect";

function setup(openDirect: (ids: string[]) => Promise<unknown>) {
  const log: string[] = [];
  const ensureOnline = vi.fn(() => true);
  const args = {
    ensureOnline,
    openDirect: vi.fn(async (ids: string[]) => {
      log.push("open");
      return openDirect(ids);
    }) as unknown as (
      ids: string[],
    ) => Promise<{ id: string; created: boolean }>,
    onClose: vi.fn(() => void log.push("close")),
    onOpenConversation: vi.fn((id: string) => void log.push(`go:${id}`)),
    userIds: ["a", "b"],
  };
  return { args, log, ensureOnline };
}

const http = (status: number, code: string, details?: unknown) =>
  new ApiError({ kind: "http", status, code, details });

describe("startDirect (TOKI-034 R22, R23)", () => {
  test("with the gate false nothing is sent", async () => {
    const { args, ensureOnline } = setup(async () => ({}));
    ensureOnline.mockReturnValue(false);
    expect(await startDirect(args)).toEqual({ kind: "blocked" });
    expect(args.openDirect).not.toHaveBeenCalled();
    expect(args.onClose).not.toHaveBeenCalled();
  });

  test("sends the ids in the order given, then closes, then opens the conversation", async () => {
    const { args, log } = setup(async () => ({ id: "c1", created: true }));
    expect(await startDirect(args)).toEqual({ kind: "started", id: "c1" });
    expect(args.openDirect).toHaveBeenCalledWith(["a", "b"]);
    expect(log).toEqual(["open", "close", "go:c1"]);
  });

  test("a 200 (created false) is handled as a 201", async () => {
    const { args, log } = setup(async () => ({ id: "c9", created: false }));
    expect(await startDirect(args)).toEqual({ kind: "started", id: "c9" });
    expect(log).toEqual(["open", "close", "go:c9"]);
  });

  test("409 person_deactivated gives the ids of details.userIds", async () => {
    const { args } = setup(async () => {
      throw http(409, ErrorCodes.personDeactivated, { userIds: ["b"] });
    });
    expect(await startDirect(args)).toEqual({
      kind: "deactivated",
      userIds: ["b"],
    });
    expect(args.onClose).not.toHaveBeenCalled();
  });

  test("409 person_deactivated with no usable details still reports it, with no ids", async () => {
    const { args } = setup(async () => {
      throw http(409, ErrorCodes.personDeactivated, null);
    });
    expect(await startDirect(args)).toEqual({
      kind: "deactivated",
      userIds: [],
    });
  });

  test("400 group_too_large is the limit safeguard", async () => {
    const { args } = setup(async () => {
      throw http(400, ErrorCodes.groupTooLarge);
    });
    expect(await startDirect(args)).toEqual({ kind: "tooLarge" });
  });

  test.each([
    [404, ErrorCodes.notFound],
    [403, ErrorCodes.forbidden],
    [400, ErrorCodes.directWithSelf],
    [400, ErrorCodes.validationFailed],
    [500, ErrorCodes.internalError],
  ])("a %s %s is a plain failure", async (status, code) => {
    const { args } = setup(async () => {
      throw http(status, code);
    });
    expect(await startDirect(args)).toEqual({ kind: "failed" });
    expect(args.onClose).not.toHaveBeenCalled();
  });

  test("no answer is a plain failure", async () => {
    const { args } = setup(async () => {
      throw new ApiError({ kind: "network" });
    });
    expect(await startDirect(args)).toEqual({ kind: "failed" });
  });
});
