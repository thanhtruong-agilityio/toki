import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CHANNEL_BROWSE_PAGE_DEFAULT, type ChannelSummary } from "@toki/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../deps";

const DEBOUNCE_MS = 250;
const KEY = "browse-channels";

export type BrowsePages = {
  // The rows of every page in order, each channel once.
  channels: ChannelSummary[];
  // The state of the first page of the current search.
  state: "loading" | "error" | "ready";
  hasMore: boolean;
  loadingMore: boolean;
  // A later page failed: the rows stay and the caller shows the line and Retry after them.
  moreFailed: boolean;
  more: () => void;
  // Asks again what failed: the first page, or the later page.
  retry: () => void;
  // The list returns to its first page and asks it again; nothing happens after unmount.
  reset: () => void;
};

// The pages of Browse channels (TOKI-034 R5, R8). The search text is debounced by 250 ms and the
// first request is sent at once. Nothing is kept between openings (`gcTime` and `staleTime` 0), so
// reopening asks again, and a new text is a new query, so the answer of an earlier text cannot
// replace the later one.
export function useBrowsePages(text: string): BrowsePages {
  const queryClient = useQueryClient();
  const trimmed = text.trim();
  const [search, setSearch] = useState(trimmed);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (trimmed === search) return;
    const timer = setTimeout(() => setSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, search]);

  const query = useInfiniteQuery({
    queryKey: [KEY, search],
    queryFn: ({ pageParam }) =>
      api.channels.list({
        search: search === "" ? undefined : search,
        limit: CHANNEL_BROWSE_PAGE_DEFAULT,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // A page is never asked twice for one cursor.
  const asked = useRef<string | undefined>(undefined);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const cursor = query.data?.pages.at(-1)?.nextCursor ?? undefined;
  useEffect(() => {
    asked.current = undefined;
  }, [search]);

  const more = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || cursor === undefined) return;
    if (asked.current === cursor) return;
    asked.current = cursor;
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, cursor, fetchNextPage]);

  const seen = new Set<string>();
  const channels: ChannelSummary[] = [];
  for (const page of query.data?.pages ?? []) {
    for (const channel of page.channels) {
      if (seen.has(channel.id)) continue;
      seen.add(channel.id);
      channels.push(channel);
    }
  }

  const moreFailed = query.isFetchNextPageError;
  const retry = useCallback(() => {
    if (query.data === undefined) {
      void query.refetch();
      return;
    }
    asked.current = undefined;
    void fetchNextPage();
  }, [query, fetchNextPage]);

  const reset = useCallback(() => {
    if (!mounted.current) return;
    asked.current = undefined;
    void queryClient.resetQueries({ queryKey: [KEY, search] });
  }, [queryClient, search]);

  return {
    channels,
    state:
      query.data !== undefined ? "ready" : query.isError ? "error" : "loading",
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    moreFailed,
    more,
    retry,
    reset,
  };
}
