// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  panelKind,
  readChannelOnce,
  useChannelRead,
  useConversation,
} from "../../src/conversation/useConversation";
import {
  detail,
  summary,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import {
  channel,
  dm,
  person,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;

beforeEach(async () => {
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch", { topic: "Ship it" }),
        channel("c2", "leadership", { isPrivate: true }),
        dm("d1", "p1"),
        { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
      ] as never,
      [person("p1", "Alex Phạm"), person("p2", "Thu Hoàng")],
    ),
    { details: [detail("c1", "project-launch", { memberCount: 3 })] },
  );
  await h.loadNow();
});

describe("useConversation (R7)", () => {
  test("returns the entry, the name, no detail and no count for a channel before the read", () => {
    const { result } = renderHook(() => useConversation("c1"));
    expect(result.current.entry?.id).toBe("c1");
    expect(result.current.name).toBe("project-launch");
    expect(result.current.detail).toBeUndefined();
    expect(result.current.memberCount).toBeUndefined();
  });

  test("the head count of a DM and of a group is memberIds.length, with no read", () => {
    expect(
      renderHook(() => useConversation("d1")).result.current.memberCount,
    ).toBe(2);
    expect(
      renderHook(() => useConversation("g1")).result.current.memberCount,
    ).toBe(3);
    expect(renderHook(() => useConversation("g1")).result.current.name).toBe(
      "Alex Phạm, Thu Hoàng",
    );
  });

  test("an id with no entry has no entry, no name and no count", () => {
    const { result } = renderHook(() => useConversation("nope"));
    expect(result.current).toEqual({
      entry: undefined,
      name: "",
      detail: undefined,
      memberCount: undefined,
    });
  });

  test("the held detail and the count appear when the read answers, and a summary is held too", async () => {
    const { result } = renderHook(() => useConversation("c1"));
    await act(async () => void (await readChannelOnce("c1")));
    expect(result.current.memberCount).toBe(3);
    expect(
      result.current.detail && "description" in result.current.detail,
    ).toBe(true);

    h.details.c2 = summary("c2", "leadership", {
      isPrivate: true,
      memberCount: 7,
    });
    const second = renderHook(() => useConversation("c2"));
    await act(async () => void (await readChannelOnce("c2")));
    expect(second.result.current.memberCount).toBe(7);
    expect(
      second.result.current.detail &&
        "description" in second.result.current.detail,
    ).toBe(false);
  });

  test("a store change from outside redraws the hook", async () => {
    const { result } = renderHook(() => useConversation("c1"));
    await act(async () => {
      await h.store.saveSettings("c1", { isStarred: true });
    });
    expect(result.current.entry?.isStarred).toBe(true);
  });

  test("the same entry object is returned while nothing changes (no render loop)", () => {
    const { result, rerender } = renderHook(() => useConversation("c1"));
    const first = result.current.entry;
    rerender();
    expect(result.current.entry).toBe(first);
  });
});

describe("panelKind: the store's kinds as the permission functions name them", () => {
  test.each([
    ["c1", "public_channel"],
    ["c2", "private_channel"],
    ["d1", "dm"],
    ["g1", "group_dm"],
  ])("%s is %s", (id, kind) => {
    expect(panelKind(h.store.getConversation(id)!)).toBe(kind);
  });
});

describe("one read of a channel in flight (R7)", () => {
  test("a second call for the same id while one runs gets the same promise and sends no request", async () => {
    const a = readChannelOnce("c1");
    const b = readChannelOnce("c1");
    expect(b).toBe(a);
    await a;
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
    await readChannelOnce("c1");
    expect(h.api.channels.get).toHaveBeenCalledTimes(2);
  });

  test("a header and a panel that mount together make one request", async () => {
    await act(async () => {
      renderHook(() => {
        useChannelRead("c1", true);
        useChannelRead("c1", true);
      });
    });
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
  });

  test("a DM and a group make no read", async () => {
    await act(async () => {
      renderHook(() => useChannelRead("d1", false));
    });
    expect(h.api.channels.get).not.toHaveBeenCalled();
  });

  test("a failed read is not raised and a later call reads again", async () => {
    h.api.channels.get.mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      renderHook(() => useChannelRead("c1", true));
    });
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
    await act(async () => void (await readChannelOnce("c1")));
    expect(h.api.channels.get).toHaveBeenCalledTimes(2);
  });
});
