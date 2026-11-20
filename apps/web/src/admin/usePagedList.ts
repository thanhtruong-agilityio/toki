import { ApiError } from "@toki/client-core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useForbidden } from "./AdminForbiddenContext";

// The state machine of a list that is asked page by page: the members of R6 and the channels of R32
// have the same rules, so they share this one. It holds the rows in memory only; they are dropped
// when the page unmounts (Data safety).
//
// Ordering (decided in the spec, R6): a first page, a reload and a change of query each start a new
// generation. The answer of any request of an earlier generation is dropped, a reload or a first
// page aborts a load-more in flight, and of two reloads in quick succession the later one wins.

export type Page<Row, Meta> = {
  rows: Row[];
  nextCursor: string | null;
  meta: Meta;
};

export type PageRequest<Query> = {
  query: Query;
  cursor?: string;
  limit?: number;
  signal: AbortSignal;
};

export type PagedListOptions<Row, Meta, Query> = {
  query: Query;
  fetchPage(request: PageRequest<Query>): Promise<Page<Row, Meta>>;
  rowKey(row: Row): string;
  // The `limit` of a reload, from the number of rows now shown; undefined asks the default page.
  reloadLimit?(shown: number): number | undefined;
};

type State<Row, Meta> = {
  status: "loading" | "ready" | "failed";
  rows: Row[];
  meta: Meta | null;
  hasMore: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  moreFailed: boolean;
};

type Action<Row, Meta> =
  | { type: "refreshStart" }
  | { type: "loaded"; page: Page<Row, Meta> }
  | { type: "failed"; error: ApiError }
  | { type: "moreStart" }
  | {
      type: "moreLoaded";
      page: Page<Row, Meta>;
      rowKey: (row: Row) => string;
    }
  | { type: "moreFailed"; error: ApiError };

function reducer<Row, Meta>(
  state: State<Row, Meta>,
  action: Action<Row, Meta>,
): State<Row, Meta> {
  switch (action.type) {
    case "refreshStart":
      // A new generation cancels a load-more in flight, and its answer is dropped, so it is no longer
      // loading: the flag must not wait for an answer that will never be used.
      return {
        ...state,
        isRefreshing: true,
        isLoadingMore: false,
        error: null,
        moreFailed: false,
      };
    case "loaded":
      return {
        status: "ready",
        rows: action.page.rows,
        meta: action.page.meta,
        hasMore: action.page.nextCursor !== null,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        moreFailed: false,
      };
    case "failed":
      // A refresh never empties the table: with rows held the status stays `ready` (TOKI-032 R10).
      return {
        ...state,
        status: state.status === "ready" ? "ready" : "failed",
        isRefreshing: false,
        // The cursor was cleared when the refresh started, so there is nothing to load until a
        // reload works; the Retry line is the way on.
        hasMore: false,
        error: action.error,
      };
    case "moreStart":
      // The error of an earlier failed page is cleared when the retry starts, so the Retry line does
      // not stay beside a request that is running.
      return { ...state, isLoadingMore: true, moreFailed: false, error: null };
    case "moreLoaded": {
      const seen = new Set(state.rows.map(action.rowKey));
      const added = action.page.rows.filter((row) => {
        const key = action.rowKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return {
        ...state,
        rows: [...state.rows, ...added],
        meta: action.page.meta,
        hasMore: action.page.nextCursor !== null,
        isLoadingMore: false,
        error: null,
      };
    }
    case "moreFailed":
      return {
        ...state,
        isLoadingMore: false,
        moreFailed: true,
        error: action.error,
      };
  }
}

export type PagedList<Row, Meta> = State<Row, Meta> & {
  loadMore(): void;
  // Resolves when the request has been answered or has failed, or was replaced by a newer one, so a
  // caller can act on the rows that are then held (the focus rule of R19). It never rejects.
  reload(): Promise<void>;
};

export function usePagedList<Row, Meta, Query>(
  options: PagedListOptions<Row, Meta, Query>,
): PagedList<Row, Meta> {
  const forbidden = useForbidden();
  const [state, dispatch] = useReducer(
    reducer as (s: State<Row, Meta>, a: Action<Row, Meta>) => State<Row, Meta>,
    {
      status: "loading",
      rows: [],
      meta: null,
      hasMore: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      moreFailed: false,
    },
  );

  // The latest options and state, for the callbacks that must stay the same function.
  const latest = useRef({ options, forbidden, shown: 0 });
  useEffect(() => {
    latest.current = { options, forbidden, shown: state.rows.length };
  });

  const generation = useRef(0);
  const first = useRef<AbortController | null>(null);
  const more = useRef<AbortController | null>(null);
  const cursor = useRef<string | null>(null);
  const loadingMore = useRef(false);
  const asked = useRef(new Set<string>());

  const fail = useCallback((error: unknown, source: "refresh" | "more") => {
    // A request that was cancelled is not a failure.
    if (error instanceof ApiError && error.kind === "aborted") return;
    // Anything that is not an ApiError means the answer could not be used.
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError({ kind: "invalid_response" });
    // A 403 means the person is no longer an Admin (R19, R32). A 401 is the client's business.
    if (apiError.status === 403) latest.current.forbidden();
    dispatch({
      type: source === "more" ? "moreFailed" : "failed",
      error: apiError,
    });
  }, []);

  const start = useCallback(
    (limit: number | undefined): Promise<void> => {
      const mine = ++generation.current;
      first.current?.abort();
      more.current?.abort();
      const controller = new AbortController();
      first.current = controller;
      more.current = null;
      loadingMore.current = false;
      asked.current = new Set();
      // The cursor of the rows being replaced does not match the new first page: no load-more may use
      // it while the page is awaited (R6).
      cursor.current = null;
      dispatch({ type: "refreshStart" });
      const { options: current } = latest.current;
      return current
        .fetchPage({
          query: current.query,
          limit,
          signal: controller.signal,
        })
        .then(
          (page) => {
            if (mine !== generation.current) return;
            cursor.current = page.nextCursor;
            dispatch({ type: "loaded", page });
          },
          (error: unknown) => {
            if (mine !== generation.current) return;
            fail(error, "refresh");
          },
        );
    },
    [fail],
  );

  // The first page, and again on every change of query.
  useEffect(() => {
    void start(undefined);
  }, [options.query, start]);

  // Nothing is kept or answered once the page is gone.
  useEffect(
    () => () => {
      generation.current += 1;
      first.current?.abort();
      more.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(() => {
    const next = cursor.current;
    // A page is never asked twice for one cursor, and nothing is asked with a null cursor.
    if (next === null || loadingMore.current || asked.current.has(next)) return;
    asked.current.add(next);
    loadingMore.current = true;
    const mine = generation.current;
    const controller = new AbortController();
    more.current = controller;
    dispatch({ type: "moreStart" });
    const { options: current } = latest.current;
    current
      .fetchPage({
        query: current.query,
        cursor: next,
        signal: controller.signal,
      })
      .then(
        (page) => {
          if (mine !== generation.current) return;
          loadingMore.current = false;
          cursor.current = page.nextCursor;
          dispatch({ type: "moreLoaded", page, rowKey: current.rowKey });
        },
        (error: unknown) => {
          if (mine !== generation.current) return;
          loadingMore.current = false;
          // The person may try this cursor again.
          asked.current.delete(next);
          fail(error, "more");
        },
      );
  }, [fail]);

  const reload = useCallback((): Promise<void> => {
    const { options: current, shown } = latest.current;
    return start(current.reloadLimit?.(shown));
  }, [start]);

  return { ...state, loadMore, reload };
}
