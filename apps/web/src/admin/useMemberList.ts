import type { MemberStatus } from "@toki/shared";
import { useCallback, useState } from "react";
import {
  listMembers,
  type MemberListView,
  type MemberRowView,
} from "./adminApi";
import { usePagedList } from "./usePagedList";

export type MemberQuery = { search: string; status?: MemberStatus };

const NO_COUNTS: MemberListView["counts"] = {
  invited: 0,
  expired: 0,
  active: 0,
  deactivated: 0,
};

// A reload asks as many rows as are shown, no less than the server's default page and no more than its
// largest (R10; TOKI-024 R21).
const RELOAD_MIN = 50;
const RELOAD_MAX = 100;

// A row is the same row when `kind` and `userId`, or `invitation.id`, are the same (R9).
const memberKey = (row: MemberRowView) =>
  `${row.kind}:${row.userId ?? row.invitation?.id ?? row.email}`;

// The list the Admin page holds (TOKI-025 R6 to R10). The rows and the addresses in them live in this
// hook's memory only and are dropped when the page unmounts.
export function useMemberList() {
  const [query, setQueryState] = useState<MemberQuery>({ search: "" });

  // The text sent is trimmed. A patch that changes nothing makes no new request.
  const setQuery = useCallback((patch: Partial<MemberQuery>) => {
    setQueryState((current) => {
      const next = {
        ...current,
        ...patch,
        search: (patch.search ?? current.search).trim(),
      };
      return next.search === current.search && next.status === current.status
        ? current
        : next;
    });
  }, []);

  const list = usePagedList({
    query,
    fetchPage: async ({ query: q, cursor, limit, signal }) => {
      const answer = await listMembers(
        { search: q.search, status: q.status, cursor, limit },
        signal,
      );
      return {
        rows: answer.members,
        nextCursor: answer.nextCursor,
        meta: {
          counts: answer.counts,
          activeAdminCount: answer.activeAdminCount,
        },
      };
    },
    rowKey: memberKey,
    reloadLimit: (shown) => Math.min(Math.max(shown, RELOAD_MIN), RELOAD_MAX),
  });

  return {
    rows: list.rows,
    counts: list.meta?.counts ?? NO_COUNTS,
    activeAdminCount: list.meta?.activeAdminCount ?? 0,
    status: list.status,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    moreFailed: list.moreFailed,
    loadMore: list.loadMore,
    reload: list.reload,
    query,
    setQuery,
  };
}
