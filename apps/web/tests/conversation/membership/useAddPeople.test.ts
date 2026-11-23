import { ApiError } from "@toki/client-core";
import { describe, expect, test, vi } from "vitest";
import { addPeople } from "../../../src/conversation/membership/useAddPeople";

const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code, message: code } as never);

function run(
  addMembers: (id: string, ids: string[]) => Promise<unknown>,
  online = true,
) {
  const ensureOnline = vi.fn(() => online);
  const fn = vi.fn(addMembers);
  return {
    ensureOnline,
    fn,
    result: addPeople({
      conversationId: "c1",
      userIds: ["u2", "u1"],
      ensureOnline,
      addMembers: fn as never,
    }),
  };
}

describe("addPeople (R8, R9)", () => {
  test("sends the ids in the order pressed", async () => {
    const { fn, result } = run(async () => ({
      added: ["u2", "u1"],
      alreadyMembers: [],
    }));
    expect(await result).toEqual({ kind: "added" });
    expect(fn).toHaveBeenCalledWith("c1", ["u2", "u1"]);
  });

  test("an empty `added` and a non-empty `alreadyMembers` are both a success", async () => {
    expect(
      await run(async () => ({ added: [], alreadyMembers: ["u2"] })).result,
    ).toEqual({
      kind: "added",
    });
    expect(
      await run(async () => ({ added: [], alreadyMembers: [] })).result,
    ).toEqual({
      kind: "added",
    });
  });

  test("offline sends nothing", async () => {
    const { fn, result } = run(async () => ({}), false);
    expect(await result).toEqual({ kind: "blocked" });
    expect(fn).not.toHaveBeenCalled();
  });

  test.each([
    ["400 invalid_member", http(400, "invalid_member"), { kind: "inactive" }],
    [
      "400 validation_failed",
      http(400, "validation_failed"),
      { kind: "failed" },
    ],
    ["409", http(409, "channel_archived"), { kind: "stale" }],
    [
      "403",
      http(403, "forbidden"),
      { kind: "no_access", error: http(403, "forbidden") },
    ],
    [
      "404",
      http(404, "not_found"),
      { kind: "no_access", error: http(404, "not_found") },
    ],
    ["500", http(500, "internal"), { kind: "failed" }],
    [
      "timeout",
      new ApiError({ kind: "timeout", message: "t" } as never),
      { kind: "failed" },
    ],
    [
      "aborted",
      new ApiError({ kind: "aborted", message: "a" } as never),
      { kind: "silent" },
    ],
  ])("%s", async (_name, error, expected) => {
    const { result } = run(async () => {
      throw error;
    });
    expect(await result).toMatchObject(expected);
  });
});
