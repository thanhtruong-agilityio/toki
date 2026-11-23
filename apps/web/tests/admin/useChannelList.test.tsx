// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { useChannelList } from "../../src/admin/useChannelList";
import {
  channel,
  createFakeAdminServer,
  failWith,
  hold,
  manyChannels,
  type FakeAdminServerOptions,
} from "../support/fakeAdminServer";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(options: FakeAdminServerOptions = {}) {
  const server = createFakeAdminServer(options).install();
  const forbidden = vi.fn();
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <AdminForbiddenContext.Provider value={forbidden}>
      {children}
    </AdminForbiddenContext.Provider>
  );
  const hook = renderHook(() => useChannelList(), { wrapper });
  return { server, forbidden, ...hook };
}

const ready = (result: { current: ReturnType<typeof useChannelList> }) =>
  waitFor(() => expect(result.current.status).toBe("ready"));

describe("the channel list (R32)", () => {
  it("asks the first page with no limit and no cursor", async () => {
    const { result, server } = setup({ channels: manyChannels(3) });
    expect(result.current.status).toBe("loading");
    await ready(result);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]?.path).toBe("/channels");
    expect(server.calls[0]?.query).toEqual({});
    expect(result.current.rows.map((c) => c.id)).toEqual([
      "c-001",
      "c-002",
      "c-003",
    ]);
  });

  it("asks the next cursor once, shows each channel once, then stops", async () => {
    const { result, server } = setup({ channels: manyChannels(120) });
    await ready(result);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(120));
    expect(new Set(result.current.rows.map((c) => c.id)).size).toBe(120);
    const before = server.calls.length;
    await act(async () => result.current.loadMore());
    expect(server.calls).toHaveLength(before);
  });

  it("never asks twice for one cursor", async () => {
    const gate = hold();
    const { result, server } = setup({
      channels: manyChannels(120),
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
    });
    await ready(result);
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(server.calls.filter((c) => c.query.cursor)).toHaveLength(1);
    gate.release();
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
  });

  it("reloads the first page only: rows past it are dropped until the person scrolls", async () => {
    const { result, server } = setup({ channels: manyChannels(120) });
    await ready(result);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    server.setChannels([
      channel(1, { name: "renamed" }),
      ...manyChannels(120).slice(1),
    ]);
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.rows).toHaveLength(50));
    expect(result.current.rows[0]?.name).toBe("renamed");
    expect(server.calls.at(-1)?.query).toEqual({});
  });

  it("aborts a load-more in flight on reload and drops its late answer", async () => {
    const gate = hold();
    const { result } = setup({
      channels: manyChannels(120),
      ignoreAbort: true,
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
    });
    await ready(result);
    act(() => result.current.loadMore());
    await act(async () => result.current.reload());
    gate.release();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.rows).toHaveLength(50);
  });

  it("keeps the list when a refresh fails, and is failed when there is none", async () => {
    let fail = false;
    const { result } = setup({
      channels: manyChannels(3),
      fail: () => (fail ? failWith(500, "internal") : undefined),
    });
    await ready(result);
    fail = true;
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.status).toBe("ready");
    expect(result.current.rows).toHaveLength(3);

    const none = setup({ fail: () => failWith(500, "internal") });
    await waitFor(() => expect(none.result.current.status).toBe("failed"));
  });

  it("is not busy and has no old error when a refresh fails after it cancelled a load-more, and clears the error when a retry works (verifier rounds 2 and 3)", async () => {
    const gate = hold();
    let failCursor = false;
    const { result } = setup({
      channels: manyChannels(120),
      ignoreAbort: true,
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
      fail: (call) =>
        failCursor && call.query.cursor
          ? failWith(500, "internal_error")
          : undefined,
    });
    await ready(result);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.isLoadingMore).toBe(false);
    gate.release();

    // A later page fails, then the retry works: no error is left beside the new rows.
    failCursor = true;
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.moreFailed).toBe(true));
    failCursor = false;
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    expect(result.current.error).toBeNull();
    expect(result.current.moreFailed).toBe(false);
  });

  it("a reload that fails after it cancelled a load-more leaves nothing busy and keeps the rows", async () => {
    const gate = hold();
    let failFirstPage = false;
    const { result } = setup({
      channels: manyChannels(120),
      ignoreAbort: true,
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
      fail: (call) =>
        failFirstPage && !call.query.cursor
          ? failWith(500, "internal_error")
          : undefined,
    });
    await ready(result);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    failFirstPage = true;
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.rows).toHaveLength(50);
    gate.release();
  });

  it("tells the page on a 403", async () => {
    const { forbidden } = setup({ fail: () => failWith(403, "forbidden") });
    await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
  });
});
