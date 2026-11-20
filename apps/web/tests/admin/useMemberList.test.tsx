// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminForbiddenContext } from "../../src/admin/AdminForbiddenContext";
import { useMemberList } from "../../src/admin/useMemberList";
import {
  createFakeAdminServer,
  failWith,
  hold,
  invitation,
  manyMembers,
  person,
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
  const hook = renderHook(() => useMemberList(), { wrapper });
  return { server, forbidden, ...hook };
}

const ready = (result: { current: ReturnType<typeof useMemberList> }) =>
  waitFor(() => expect(result.current.status).toBe("ready"));

const cursorCalls = (server: { calls: { query: Record<string, string> }[] }) =>
  server.calls.filter((c) => c.query.cursor !== undefined);

describe("the first page (R6)", () => {
  it("asks with no limit and holds rows, counts and the Admin count", async () => {
    const members = [
      person({ n: 1, role: "admin" }),
      person({ n: 2 }),
      person({ n: 3, status: "deactivated" }),
      invitation({ n: 4 }),
      invitation({ n: 5, status: "expired" }),
    ];
    const { result, server } = setup({ members });
    expect(result.current.status).toBe("loading");
    await ready(result);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]?.query.limit).toBeUndefined();
    expect(result.current.rows).toHaveLength(5);
    expect(result.current.counts).toEqual({
      active: 2,
      deactivated: 1,
      invited: 1,
      expired: 1,
    });
    expect(result.current.activeAdminCount).toBe(1);
    expect(result.current.query).toEqual({ search: "" });
  });

  it("gives dates to the rows as numbers", async () => {
    const { result } = setup({ members: [person({ n: 1 })] });
    await ready(result);
    expect(typeof result.current.rows[0]?.lastActiveAt).toBe("number");
  });
});

describe("a change of query (R6, R7, R8)", () => {
  it("asks the first page again, keeps the old rows while it waits and then replaces them", async () => {
    const gate = hold();
    const { result, server } = setup({
      members: [person({ n: 1 }), person({ n: 2, displayName: "Lan" })],
      gate: (call) => (call.query.search === "lan" ? gate.promise : undefined),
    });
    await ready(result);
    act(() => result.current.setQuery({ search: "lan" }));
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.status).toBe("ready");
    gate.release();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.isRefreshing).toBe(false);
    expect(server.calls.at(-1)?.query).toEqual({ search: "lan" });
  });

  it("sends the status of a chip", async () => {
    const { result, server } = setup({
      members: [person({ n: 1 }), invitation({ n: 2 })],
    });
    await ready(result);
    act(() => result.current.setQuery({ status: "invited" }));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(server.calls.at(-1)?.query.status).toBe("invited");
  });

  it("drops the answer of an older query even when it arrives last", async () => {
    const old = hold();
    const { result } = setup({
      members: [
        person({ n: 1, displayName: "Old One" }),
        person({ n: 2, displayName: "New One" }),
      ],
      ignoreAbort: true,
      gate: (call) => (call.query.search === "old" ? old.promise : undefined),
    });
    await ready(result);
    act(() => result.current.setQuery({ search: "old" }));
    act(() => result.current.setQuery({ search: "new" }));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]?.displayName).toBe("New One");
    old.release();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.rows[0]?.displayName).toBe("New One");
  });

  it("sends the search text trimmed (R7)", async () => {
    const { result, server } = setup({ members: [person({ n: 1 })] });
    await ready(result);
    act(() => result.current.setQuery({ search: "  nguyen  " }));
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[1]?.query.search).toBe("nguyen");
    expect(result.current.query.search).toBe("nguyen");
  });

  it("finds Vietnamese typed without diacritics, as the server does (concern 2)", async () => {
    const { result } = setup({
      members: [
        person({ n: 1, displayName: "Nguyễn Văn An" }),
        person({ n: 2, displayName: "Lan" }),
      ],
    });
    await ready(result);
    act(() => result.current.setQuery({ search: "nguyen" }));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]?.displayName).toBe("Nguyễn Văn An");
  });

  it("does not ask again for a query that did not change", async () => {
    const { result, server } = setup({ members: [person({ n: 1 })] });
    await ready(result);
    act(() => result.current.setQuery({ search: "" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(server.calls).toHaveLength(1);
  });
});

describe("more on scroll (R9)", () => {
  it("asks the next cursor, shows each row once over 120 rows, then stops", async () => {
    const { result, server } = setup({ members: manyMembers(120) });
    await ready(result);
    expect(result.current.rows).toHaveLength(50);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(120));
    const ids = result.current.rows.map((r) => r.userId);
    expect(new Set(ids).size).toBe(120);
    const before = server.calls.length;
    await act(async () => result.current.loadMore());
    expect(server.calls).toHaveLength(before);
  });

  it("asks no page with the old cursor while a new first page is awaited (verifier finding)", async () => {
    const gate = hold();
    const { result, server } = setup({
      members: manyMembers(120),
      gate: (call) =>
        call.query.search === "member" ? gate.promise : undefined,
    });
    await ready(result);
    // The old query still holds the cursor "o:50". A new query starts a new generation.
    act(() => result.current.setQuery({ search: "member" }));
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    act(() => result.current.loadMore());
    // No request was made with the cursor of the earlier rows.
    expect(cursorCalls(server)).toHaveLength(0);
    gate.release();
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(cursorCalls(server)).toHaveLength(0);
    expect(result.current.rows).toHaveLength(50);
  });

  it("is not busy any more when a refresh fails after it cancelled a load-more (verifier round 2)", async () => {
    const gate = hold();
    const { result } = setup({
      members: manyMembers(120),
      ignoreAbort: true,
      // A reload asks with a limit: it fails. The load-more has a cursor: it is held.
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
      fail: (call) =>
        call.query.limit ? failWith(500, "internal_error") : undefined,
    });
    await ready(result);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
    gate.release();
  });

  it("has nothing more to load after a refresh failed, until a reload works (verifier round 3)", async () => {
    let fail = false;
    const { result } = setup({
      members: manyMembers(120),
      fail: () => (fail ? failWith(500, "internal_error") : undefined),
    });
    await ready(result);
    expect(result.current.hasMore).toBe(true);
    fail = true;
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.hasMore).toBe(false);
    fail = false;
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.hasMore).toBe(true);
  });

  it("never asks twice for one cursor", async () => {
    const gate = hold();
    const { result, server } = setup({
      members: manyMembers(120),
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
    });
    await ready(result);
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(cursorCalls(server)).toHaveLength(1);
    gate.release();
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    // The cursor was used and answered: asking with the same state again asks the next one only.
    expect(cursorCalls(server)).toHaveLength(1);
  });

  it("shows no row twice when a page repeats one", async () => {
    const members = manyMembers(60);
    const { result, server } = setup({ members });
    await ready(result);
    // A person is added at the front: the second page starts at "o:50" of the longer list, so it
    // repeats the last row of the first page and then holds the ten rows that follow.
    server.setMembers([person({ n: 0, displayName: "Aaa First" }), ...members]);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(60));
    const keys = result.current.rows.map((r) => r.userId);
    expect(new Set(keys).size).toBe(60);
  });

  it("keeps the rows when a later page fails and lets the person try again with the same cursor", async () => {
    let fail = true;
    const { result, server } = setup({
      members: manyMembers(120),
      fail: (call) =>
        call.query.cursor && fail ? failWith(500, "internal") : undefined,
    });
    await ready(result);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.moreFailed).toBe(true));
    expect(result.current.rows).toHaveLength(50);
    expect(result.current.status).toBe("ready");
    expect(result.current.error).not.toBeNull();
    fail = false;
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    expect(result.current.moreFailed).toBe(false);
    // The error of the failed page is gone once the retry worked (verifier round 3).
    expect(result.current.error).toBeNull();
    expect(cursorCalls(server).map((c) => c.query.cursor)).toEqual([
      "o:50",
      "o:50",
    ]);
  });
});

describe("reload after a change (R10)", () => {
  it("asks as many rows as are shown, no less than 50 and no more than 100", async () => {
    const { result, server } = setup({ members: manyMembers(60) });
    await ready(result);
    // 50 rows shown: 50.
    await act(async () => result.current.reload());
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[1]?.query.limit).toBe("50");
    expect(server.calls[1]?.query.cursor).toBeUndefined();
    // 60 rows shown: 60.
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(60));
    await act(async () => result.current.reload());
    await waitFor(() => expect(server.calls.at(-1)?.query.limit).toBe("60"));
  });

  it("asks at most 100 even when more rows are shown", async () => {
    const { result, server } = setup({ members: manyMembers(120) });
    await ready(result);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(120));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.rows).toHaveLength(100));
    expect(server.calls.at(-1)?.query.limit).toBe("100");
  });

  it("asks with the same query and replaces rows, counts and the Admin count", async () => {
    const { result, server } = setup({
      members: [person({ n: 1, role: "admin" }), person({ n: 2 })],
    });
    await ready(result);
    act(() => result.current.setQuery({ status: "active" }));
    await waitFor(() => expect(server.calls).toHaveLength(2));
    server.setMembers([
      person({ n: 1, role: "admin" }),
      person({ n: 2, status: "deactivated" }),
    ]);
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(server.calls.at(-1)?.query.status).toBe("active");
    expect(result.current.counts).toMatchObject({ active: 1, deactivated: 1 });
    expect(result.current.activeAdminCount).toBe(1);
  });

  it("aborts a load-more in flight and drops its late answer", async () => {
    const gate = hold();
    const { result } = setup({
      members: manyMembers(120),
      ignoreAbort: true,
      gate: (call) => (call.query.cursor ? gate.promise : undefined),
    });
    await ready(result);
    act(() => result.current.loadMore());
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    gate.release();
    await act(async () => {
      await Promise.resolve();
    });
    // The rows that replaced the old ones are not followed by a page with a cursor that no
    // longer matches.
    expect(result.current.rows).toHaveLength(50);
  });

  it("keeps the later of two reloads started in quick succession", async () => {
    const first = hold();
    let calls = 0;
    const { result, server } = setup({
      members: [person({ n: 1, displayName: "Before" })],
      ignoreAbort: true,
      gate: () => {
        calls += 1;
        return calls === 2 ? first.promise : undefined;
      },
    });
    await ready(result);
    act(() => {
      void result.current.reload();
    });
    server.setMembers([person({ n: 1, displayName: "After" })]);
    await act(async () => result.current.reload());
    await waitFor(() =>
      expect(result.current.rows[0]?.displayName).toBe("After"),
    );
    first.release();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.rows[0]?.displayName).toBe("After");
  });
});

describe("failures (R6, R14, R19)", () => {
  it("is failed when the first load fails and ready after a reload that works", async () => {
    let fail = true;
    const { result } = setup({
      members: [person({ n: 1 })],
      fail: () => (fail ? failWith(500, "internal") : undefined),
    });
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toMatchObject({ kind: "http", status: 500 });
    expect(result.current.rows).toEqual([]);
    fail = false;
    await act(async () => result.current.reload());
    await ready(result);
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toHaveLength(1);
  });

  it("keeps the table when a refresh fails", async () => {
    let fail = false;
    const { result } = setup({
      members: [person({ n: 1 }), person({ n: 2 })],
      fail: () => (fail ? failWith(500, "internal") : undefined),
    });
    await ready(result);
    fail = true;
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.status).toBe("ready");
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("is failed with an unreadable error when the answer does not fit the schema", async () => {
    const { result } = setup({
      fail: () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toMatchObject({ kind: "invalid_response" });
  });

  it("tells the page on a 403, for the first page and for a later one", async () => {
    const first = setup({ fail: () => failWith(403, "forbidden") });
    await waitFor(() => expect(first.forbidden).toHaveBeenCalledTimes(1));

    let deny = false;
    const later = setup({
      members: manyMembers(120),
      fail: (call) =>
        deny && call.query.cursor ? failWith(403, "forbidden") : undefined,
    });
    await ready(later.result);
    deny = true;
    await act(async () => later.result.current.loadMore());
    await waitFor(() => expect(later.forbidden).toHaveBeenCalledTimes(1));
  });

  it("does not tell the page about a failure that is not a 403", async () => {
    const { result, forbidden } = setup({
      fail: () => failWith(500, "internal"),
    });
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("holds no state of its own after the page goes away", async () => {
    const gate = hold();
    const { result, unmount, forbidden } = setup({
      members: [person({ n: 1 })],
      gate: () => gate.promise,
    });
    unmount();
    gate.release();
    await act(async () => {
      await Promise.resolve();
    });
    expect(forbidden).not.toHaveBeenCalled();
    expect(result.current.status).toBe("loading");
  });
});
