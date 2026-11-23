import type { BootstrapPerson } from "@toki/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, conversations } from "../client";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { readFailure } from "./readFailure";

// 100 is the server's maximum for one page (TOKI-029 R8); 200 people take 2 requests (NFR-04).
export const MEMBERS_PAGE = 100;
// A list that still has a cursor after this many requests is shown as it is.
export const MEMBERS_MAX_REQUESTS = 10;

// The collator of the store's names (TOKI-032 R18): case ignored, accents kept; a tie goes by id.
const collator = new Intl.Collator("vi", { sensitivity: "accent" });
export function compareByName(a: BootstrapPerson, b: BootstrapPerson): number {
  const byName = collator.compare(a.displayName, b.displayName);
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type ChannelMembers = {
  // The people drawn, sorted by name.
  rows: BootstrapPerson[];
  // The `userId` of every page read, the ids the store does not know included.
  ids: string[];
  status: "loading" | "ready" | "failed";
  error: unknown;
  reload: () => Promise<void>;
};

async function readAll(id: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let request = 0; request < MEMBERS_MAX_REQUESTS; request += 1) {
    const page = await api.channels.members(id, {
      limit: MEMBERS_PAGE,
      cursor,
    });
    for (const member of page.members) ids.push(member.userId);
    if (page.nextCursor === null) break;
    cursor = page.nextCursor;
  }
  return ids;
}

// The members of a channel (R13): every page of `api.channels.members`, turned into the people of
// the store. A half-loaded list is never drawn: the held rows are replaced only when every page has
// answered, and a reload with rows held never goes back to "loading". A person the store does not
// hold is left out of `rows`; the store is refreshed once and the row appears if it then holds them.
export function useChannelMembers(
  id: string,
  onNoAccess: () => void,
  enabled = true,
): ChannelMembers {
  const [ids, setIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ChannelMembers["status"]>("loading");
  const [error, setError] = useState<unknown>(null);
  const people = useConversationSelector((s) => s.getState().people);
  const held = useRef(false);
  // The read in flight and the id it reads: a read for another id is neither shared nor applied.
  const running = useRef<{ id: string; promise: Promise<void> } | null>(null);
  const current = useRef(id);
  current.current = id;
  const latest = useRef(onNoAccess);
  latest.current = onNoAccess;

  const reload = useCallback((): Promise<void> => {
    if (running.current?.id === id) return running.current.promise;
    const slot: { id: string; promise: Promise<void> } = {
      id,
      promise: Promise.resolve(),
    };
    slot.promise = (async () => {
      try {
        const next = await readAll(id);
        if (current.current !== id) return;
        held.current = true;
        setIds(next);
        setStatus("ready");
        setError(null);
        const state = conversations.getState();
        if (next.some((userId) => state.people[userId] === undefined)) {
          // A failed refresh only leaves the row out: the list is ready.
          try {
            await conversations.refresh();
          } catch {
            // ignored
          }
        }
      } catch (failure) {
        if (current.current !== id) return;
        setError(failure);
        if (readFailure(failure) === "no_access") latest.current();
        if (!held.current) setStatus("failed");
      } finally {
        if (running.current === slot) running.current = null;
      }
    })();
    running.current = slot;
    return slot.promise;
  }, [id]);

  useEffect(() => {
    if (!enabled) return;
    held.current = false;
    setIds([]);
    setStatus("loading");
    setError(null);
    void reload();
  }, [enabled, id, reload]);

  const rows = useMemo(
    () =>
      ids
        .map((userId) => people[userId])
        .filter((p): p is BootstrapPerson => p !== undefined)
        .sort(compareByName),
    [ids, people],
  );

  return { rows, ids, status, error, reload };
}
