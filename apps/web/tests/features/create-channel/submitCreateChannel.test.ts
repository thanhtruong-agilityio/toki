import { ApiError, classifyApiError } from "@toki/client-core";
import { UUID_V7_PATTERN } from "@toki/shared";
import { describe, expect, test, vi } from "vitest";
import {
  idFor,
  submitCreateChannel,
  type Attempt,
  type CreateBody,
} from "../../../src/features/create-channel/submitCreateChannel";

vi.mock("../../../src/features/create-channel/deps", async () => {
  const core = await import("@toki/client-core");
  return { ApiError: core.ApiError, classifyApiError: core.classifyApiError };
});

const ID = "017f22e2-79b0-7cc3-98c4-dc0c0c07398f";

function makeIds() {
  let n = 0;
  return vi.fn(
    () => `017f22e2-79b0-7cc3-98c4-${String(++n).padStart(12, "0")}`,
  );
}

function setup(createChannel?: (body: unknown) => Promise<unknown>) {
  const newId = makeIds();
  const command = vi.fn(
    createChannel ??
      (async (body: unknown) => ({
        id: (body as { id: string }).id,
        created: true,
      })),
  );
  const ensureOnline = vi.fn(() => true);
  const attempt: { current: Attempt } = { current: null };
  const run = (
    values: Partial<Parameters<typeof submitCreateChannel>[0]["values"]> = {},
  ) =>
    submitCreateChannel({
      ensureOnline,
      createChannel: command as never,
      newId,
      attempt,
      values: {
        name: "qa-team",
        isPrivate: false,
        topic: "",
        memberIds: [],
        ...values,
      },
    });
  return { run, command, ensureOnline, newId, attempt };
}

describe("body (R11)", () => {
  test("a public channel with no topic and no people sends name and isPrivate only", async () => {
    const { run, command } = setup();
    const result = await run();
    expect(command).toHaveBeenCalledTimes(1);
    const body = command.mock.calls[0]![0] as Record<string, unknown>;
    expect(body).toEqual({
      id: expect.any(String),
      name: "qa-team",
      isPrivate: false,
    });
    expect("topic" in body).toBe(false);
    expect("memberIds" in body).toBe(false);
    expect(result).toEqual({ kind: "created", id: body.id });
  });

  test("isPrivate true, a trimmed topic and people in the order pressed", async () => {
    const { run, command } = setup();
    await run({ isPrivate: true, topic: "  Plans  ", memberIds: ["p2", "p1"] });
    expect(command.mock.calls[0]![0]).toMatchObject({
      name: "qa-team",
      isPrivate: true,
      topic: "Plans",
      memberIds: ["p2", "p1"],
    });
  });

  test("white space alone is no topic", async () => {
    const { run, command } = setup();
    await run({ topic: "   " });
    expect("topic" in (command.mock.calls[0]![0] as object)).toBe(false);
  });

  test("no createdBy, workspace or role", async () => {
    const { run, command } = setup();
    await run({ memberIds: ["p1"] });
    expect(Object.keys(command.mock.calls[0]![0] as object).sort()).toEqual([
      "id",
      "isPrivate",
      "memberIds",
      "name",
    ]);
  });

  test("the id matches the pattern of the server", async () => {
    const real = await import("../../../src/ids").then((m) => m.newId);
    const command = vi.fn(async (b: { id: string }) => ({
      id: b.id,
      created: true,
    }));
    await submitCreateChannel({
      ensureOnline: () => true,
      createChannel: command as never,
      newId: real,
      attempt: { current: null },
      values: { name: "a", isPrivate: false, topic: "", memberIds: [] },
    });
    expect(command.mock.calls[0]![0].id).toMatch(UUID_V7_PATTERN);
  });
});

describe("offline (R11 step 1)", () => {
  test("sends nothing, makes no id", async () => {
    const { run, command, ensureOnline, newId, attempt } = setup();
    ensureOnline.mockReturnValue(false);
    expect(await run()).toEqual({ kind: "blocked" });
    expect(command).not.toHaveBeenCalled();
    expect(newId).not.toHaveBeenCalled();
    expect(attempt.current).toBeNull();
  });
});

describe("idFor (R15)", () => {
  const body: CreateBody = {
    name: "a",
    isPrivate: false,
    topic: "t",
    memberIds: ["p1", "p2"],
  };
  const same = () => ({ ...body, memberIds: [...body.memberIds!] });

  test("the same body reuses the id", () => {
    const newId = makeIds();
    const attempt: { current: Attempt } = { current: null };
    const first = idFor(attempt, body, newId);
    expect(idFor(attempt, same(), newId)).toBe(first);
    expect(newId).toHaveBeenCalledTimes(1);
  });

  test.each<[string, Partial<CreateBody>]>([
    ["the name", { name: "b" }],
    ["the switch", { isPrivate: true }],
    ["the topic", { topic: "u" }],
    ["no topic", { topic: undefined }],
    ["the order of two people", { memberIds: ["p2", "p1"] }],
    ["one person added", { memberIds: ["p1", "p2", "p3"] }],
    ["one person removed", { memberIds: ["p1"] }],
    ["no people", { memberIds: undefined }],
  ])("a change of %s makes a new id", (_what, change) => {
    const newId = makeIds();
    const attempt: { current: Attempt } = { current: null };
    const first = idFor(attempt, body, newId);
    const second = idFor(attempt, { ...same(), ...change }, newId);
    expect(second).not.toBe(first);
    // and the new attempt is the one kept
    expect(idFor(attempt, { ...same(), ...change }, newId)).toBe(second);
  });

  test("an id is kept across a network failure and the retry sends the same id", async () => {
    let fail = true;
    const { run, command } = setup(async (b) => {
      if (fail) throw new ApiError({ kind: "network" });
      return { id: (b as { id: string }).id, created: false };
    });
    expect(await run()).toEqual({ kind: "failed" });
    fail = false;
    const result = await run();
    expect(command.mock.calls[0]![0]).toMatchObject({
      id: (command.mock.calls[1]![0] as { id: string }).id,
    });
    expect(result.kind).toBe("created");
  });
});

describe("answers (R13, R14)", () => {
  const http = (status: number, code: string | null = null) =>
    new ApiError({ kind: "http", status, code });
  const rows: Array<[string, ApiError, string]> = [
    ["409 channel_name_taken", http(409, "channel_name_taken"), "nameTaken"],
    ["400 invalid_member", http(400, "invalid_member"), "invalidMember"],
    ["409 channel_id_in_use", http(409, "channel_id_in_use"), "failed"],
    ["409 other code", http(409, "other"), "failed"],
    ["400 validation_failed", http(400, "validation_failed"), "failed"],
    ["403", http(403, "forbidden"), "failed"],
    ["404", http(404), "failed"],
    ["429", http(429), "failed"],
    ["500", http(500), "failed"],
    ["timeout", new ApiError({ kind: "timeout" }), "failed"],
    ["network", new ApiError({ kind: "network" }), "failed"],
    ["invalid_response", new ApiError({ kind: "invalid_response" }), "failed"],
    ["aborted", new ApiError({ kind: "aborted" }), "silent"],
    ["401 session_ended", http(401, "session_ended"), "silent"],
    ["not an ApiError", new Error("boom") as ApiError, "failed"],
  ];
  test.each(rows)("%s", async (_name, error, kind) => {
    const { run } = setup(async () => {
      throw error;
    });
    expect((await run()).kind).toBe(kind);
  });

  test("classifyApiError is the one that decides the rest", () => {
    expect(classifyApiError(http(429))).toBe("wait");
  });

  test("channel_id_in_use forgets the attempt", async () => {
    const { run, attempt } = setup(async () => {
      throw http(409, "channel_id_in_use");
    });
    await run();
    expect(attempt.current).toBeNull();
  });

  test("a name taken keeps the attempt", async () => {
    const { run, attempt } = setup(async () => {
      throw http(409, "channel_name_taken");
    });
    await run();
    expect(attempt.current).not.toBeNull();
  });

  test("a success reports the id of the answer", async () => {
    const { run } = setup(async () => ({ id: ID, created: false }));
    expect(await run()).toEqual({ kind: "created", id: ID });
  });
});
