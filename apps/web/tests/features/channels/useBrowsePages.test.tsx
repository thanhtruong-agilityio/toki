// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useBrowsePages } from "../../../src/features/channels/useBrowsePages";
import { fake, resetFake } from "../fakeDeps";

vi.mock("../../../src/features/deps", async () =>
  (await import("../fakeDeps")).makeDepsMock(),
);

const channels = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `c${from + i}`,
    name: `channel-${from + i}`,
    topic: null,
    isPrivate: false,
    isGeneral: false,
    archived: false,
    memberCount: 1,
    isMember: false,
  }));

function wrapper() {
  const client = new QueryClient();
  return ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  resetFake();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

describe("useBrowsePages (TOKI-034 R5, R8)", () => {
  test("the first request has limit 50 and no search", async () => {
    fake.list.mockResolvedValue({ channels: channels(1, 3), nextCursor: null });
    const { result } = renderHook(() => useBrowsePages(""), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.channels).toHaveLength(3));
    expect(fake.list).toHaveBeenCalledTimes(1);
    expect(fake.list).toHaveBeenCalledWith({
      search: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  test("typing asks once after 250 ms with the trimmed text", async () => {
    fake.list.mockResolvedValue({ channels: [], nextCursor: null });
    const { result, rerender } = renderHook(
      ({ text }) => useBrowsePages(text),
      { wrapper: wrapper(), initialProps: { text: "" } },
    );
    await waitFor(() => expect(fake.list).toHaveBeenCalledTimes(1));
    rerender({ text: "d" });
    rerender({ text: "de" });
    rerender({ text: " des " });
    await act(async () => void vi.advanceTimersByTime(249));
    expect(fake.list).toHaveBeenCalledTimes(1);
    await act(async () => void vi.advanceTimersByTime(2));
    await waitFor(() => expect(fake.list).toHaveBeenCalledTimes(2));
    expect(fake.list).toHaveBeenLastCalledWith({
      search: "des",
      limit: 50,
      cursor: undefined,
    });
    expect(result.current.state).not.toBe("error");
  });

  test("an answer for an earlier text that arrives after a later one is ignored", async () => {
    let releaseOld: (v: unknown) => void = () => {};
    fake.list.mockImplementationOnce(
      () => new Promise((resolve) => (releaseOld = resolve)),
    );
    fake.list.mockResolvedValueOnce({
      channels: channels(10, 10),
      nextCursor: null,
    });
    const { result, rerender } = renderHook(
      ({ text }) => useBrowsePages(text),
      { wrapper: wrapper(), initialProps: { text: "a" } },
    );
    rerender({ text: "ab" });
    await act(async () => void vi.advanceTimersByTime(300));
    await waitFor(() =>
      expect(result.current.channels.map((c) => c.id)).toEqual(["c10"]),
    );
    await act(async () =>
      releaseOld({ channels: channels(1, 2), nextCursor: null }),
    );
    expect(result.current.channels.map((c) => c.id)).toEqual(["c10"]);
  });

  test("asks the next page with its cursor once, never twice for one cursor, and shows each channel once", async () => {
    fake.list
      .mockResolvedValueOnce({ channels: channels(1, 50), nextCursor: "k2" })
      .mockResolvedValueOnce({ channels: channels(50, 100), nextCursor: null });
    const { result } = renderHook(() => useBrowsePages(""), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.channels).toHaveLength(50));
    expect(result.current.hasMore).toBe(true);
    act(() => {
      result.current.more();
      result.current.more();
    });
    await waitFor(() => expect(result.current.channels).toHaveLength(100));
    expect(fake.list).toHaveBeenCalledTimes(2);
    expect(fake.list).toHaveBeenLastCalledWith({
      search: undefined,
      limit: 50,
      cursor: "k2",
    });
    expect(new Set(result.current.channels.map((c) => c.id)).size).toBe(100);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.more());
    expect(fake.list).toHaveBeenCalledTimes(2);
  });

  test("a failed first page is an error; retry asks again", async () => {
    fake.list.mockRejectedValueOnce(new Error("down"));
    fake.list.mockResolvedValueOnce({
      channels: channels(1, 1),
      nextCursor: null,
    });
    const { result } = renderHook(() => useBrowsePages(""), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.state).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.channels).toHaveLength(1));
    expect(fake.list).toHaveBeenCalledTimes(2);
  });

  test("a failed later page keeps the rows and says so", async () => {
    fake.list
      .mockResolvedValueOnce({ channels: channels(1, 2), nextCursor: "k2" })
      .mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useBrowsePages(""), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.channels).toHaveLength(2));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.moreFailed).toBe(true));
    expect(result.current.channels).toHaveLength(2);
    expect(result.current.state).toBe("ready");
  });

  test("reset returns to the first page and asks it again", async () => {
    fake.list
      .mockResolvedValueOnce({ channels: channels(1, 50), nextCursor: "k2" })
      .mockResolvedValueOnce({ channels: channels(51, 52), nextCursor: null })
      .mockResolvedValueOnce({ channels: channels(1, 3), nextCursor: null });
    const { result } = renderHook(() => useBrowsePages(""), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.channels).toHaveLength(50));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.channels).toHaveLength(52));
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.channels).toHaveLength(3));
    expect(fake.list).toHaveBeenLastCalledWith({
      search: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  test("reopening asks again: nothing is kept between openings", async () => {
    fake.list.mockResolvedValue({ channels: channels(1, 1), nextCursor: null });
    const w = wrapper();
    const first = renderHook(() => useBrowsePages(""), { wrapper: w });
    await waitFor(() => expect(first.result.current.channels).toHaveLength(1));
    first.unmount();
    renderHook(() => useBrowsePages(""), { wrapper: w });
    await waitFor(() => expect(fake.list).toHaveBeenCalledTimes(2));
  });
});
