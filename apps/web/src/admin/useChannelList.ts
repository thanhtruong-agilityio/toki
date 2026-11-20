import type { ChannelSummary } from "@toki/shared";
import { api } from "../client";
import { usePagedList } from "./usePagedList";

// There is no query: the same value every render, so the first page is asked once (R32).
const NO_QUERY = null;

// The channels of the Channels section (TOKI-025 R25, R32): the first page with no `limit` and more
// on scroll. A reload asks the first page again, so rows past it are dropped until the person
// scrolls. The server's order and cursor are kept as they come.
export function useChannelList() {
  const list = usePagedList<ChannelSummary, null, null>({
    query: NO_QUERY,
    fetchPage: async ({ cursor, signal }) => {
      const answer = await api.channels.list({ cursor }, signal);
      return {
        rows: answer.channels,
        nextCursor: answer.nextCursor,
        meta: null,
      };
    },
    rowKey: (channel) => channel.id,
  });
  return {
    rows: list.rows,
    status: list.status,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    moreFailed: list.moreFailed,
    loadMore: list.loadMore,
    reload: list.reload,
  };
}
