// @vitest-environment jsdom
import { ApiError } from "@toki/client-core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useChannelMembers } from "../../src/conversation/useChannelMembers";
import {
  crowd,
  detail,
  http,
  members,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { channel, person, workspaceBody } from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;

async function setup(count: number, extraPeople = 0) {
  const { people, rows } = crowd(count + extraPeople);
  h = useFakeApi(
    workspaceBody(
      [channel("c1", "project-launch")],
      people.map((p) => person(p.id, p.displayName)),
    ),
    {
      details: [detail("c1", "project-launch")],
      members: { c1: rows.slice(0, count) },
    },
  );
  await h.loadNow();
}

const mount = (onNoAccess = vi.fn()) => {
  const view = renderHook(() => useChannelMembers("c1", onNoAccess));
  return { ...view, onNoAccess };
};

const requests = () => h.api.channels.members.mock.calls.map((c) => c[1]);

describe("pages (R13)", () => {
  test("3 people take one request of 100 and are rows sorted by name", async () => {
    await setup(3);
    const { result } = mount();
    expect(result.current.status).toBe("loading");
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(requests()).toEqual([{ limit: 100, cursor: undefined }]);
    expect(result.current.rows.map((r) => r.displayName)).toEqual([
      "Member 001",
      "Member 002",
      "Member 003",
    ]);
    expect(result.current.ids).toEqual(["p1", "p2", "p3"]);
    expect(result.current.error).toBeNull();
  });

  test.each([
    [120, 2],
    [200, 2],
    [201, 3],
  ])("%i people take %i requests of 100", async (count, calls) => {
    await setup(count);
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(h.api.channels.members).toHaveBeenCalledTimes(calls);
    expect(requests().every((q) => q.limit === 100)).toBe(true);
    expect(requests()[1].cursor).toBe("100");
    expect(result.current.rows).toHaveLength(count);
    expect(result.current.ids).toHaveLength(count);
  });

  test("a list that still has a cursor after 10 requests stops, keeps its rows and raises no error", async () => {
    await setup(10);
    h.api.channels.members.mockImplementation(async () => ({
      members: members(2, "q"),
      nextCursor: "more",
    }));
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(h.api.channels.members).toHaveBeenCalledTimes(10);
    expect(result.current.ids).toHaveLength(20);
    expect(result.current.error).toBeNull();
  });
});

describe("a person the store does not hold (decision of the grilling round)", () => {
  test("is in ids, not in rows, and the store is refreshed once", async () => {
    await setup(3);
    h.memberRows.c1 = [...members(3), { userId: "ghost", joinedAt: "x" }];
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(h.bootstrapCalls()).toBe(2));
    expect(result.current.ids).toContain("ghost");
    expect(result.current.rows.map((r) => r.id)).not.toContain("ghost");
    expect(result.current.rows).toHaveLength(3);
    expect(h.bootstrapCalls()).toBe(2);
  });

  test("when the refresh brings the person the row is drawn", async () => {
    await setup(3);
    h.memberRows.c1 = [...members(3), { userId: "ghost", joinedAt: "x" }];
    const body = workspaceBody(
      [channel("c1", "project-launch")],
      [
        ...crowd(3).people.map((p) => person(p.id, p.displayName)),
        person("ghost", "Ghost Lan"),
      ],
    );
    h.answer(body);
    const { result } = mount();
    await waitFor(() => expect(result.current.rows).toHaveLength(4));
    expect(result.current.rows.map((r) => r.displayName)).toContain(
      "Ghost Lan",
    );
    expect(h.bootstrapCalls()).toBe(2);
  });

  test("no refresh is made when every person is known", async () => {
    await setup(3);
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(h.bootstrapCalls()).toBe(1);
  });
});

describe("failure and reload (R13, R14)", () => {
  test("a failed first read is failed with the error and no rows; reload recovers", async () => {
    await setup(3);
    h.api.channels.members.mockRejectedValueOnce(http(500));
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.rows).toEqual([]);
    await act(async () => result.current.reload());
    expect(result.current.status).toBe("ready");
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  test("a first read that is no_access goes to onNoAccess", async () => {
    await setup(3);
    h.api.channels.members.mockRejectedValueOnce(http(404));
    const { onNoAccess } = mount();
    await waitFor(() => expect(onNoAccess).toHaveBeenCalledTimes(1));
  });

  test("reload keeps the rows while it runs, never shows loading, and replaces them only after every page answered", async () => {
    await setup(120);
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // The server now has 130 people; its second page is held.
    const next = crowd(130);
    h.memberRows.c1 = next.rows;
    let release: () => void = () => {};
    const original = h.api.channels.members.getMockImplementation() as (
      id: string,
      q: object,
    ) => Promise<unknown>;
    h.api.channels.members.mockImplementation(
      async (id: string, q: { cursor?: string }) => {
        if (q.cursor === "100")
          await new Promise<void>((r) => void (release = r));
        return original(id, q);
      },
    );
    let done!: Promise<void>;
    act(() => {
      done = result.current.reload();
    });
    await waitFor(() => expect(release).toBeDefined());
    expect(result.current.status).toBe("ready");
    expect(result.current.rows).toHaveLength(120);
    expect(result.current.ids).toHaveLength(120);
    await act(async () => {
      release();
      await done;
    });
    expect(result.current.ids).toHaveLength(130);
  });

  test("a failed reload with rows held keeps them and the status", async () => {
    await setup(3);
    const { result } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    h.api.channels.members.mockRejectedValueOnce(http(500));
    await act(async () => result.current.reload());
    expect(result.current.status).toBe("ready");
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  test("a failed reload that is no_access is applied even with rows held", async () => {
    await setup(3);
    const { result, onNoAccess } = mount();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    h.api.channels.members.mockRejectedValueOnce(http(403));
    await act(async () => result.current.reload());
    expect(onNoAccess).toHaveBeenCalledTimes(1);
    expect(result.current.rows).toHaveLength(3);
  });

  test("a disabled hook makes no request", async () => {
    await setup(3);
    renderHook(() => useChannelMembers("c1", vi.fn(), false));
    await act(async () => {});
    expect(h.api.channels.members).not.toHaveBeenCalled();
  });
});
