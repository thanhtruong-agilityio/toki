import type { ChannelRead } from "@toki/client-core";
import type { BootstrapConversation, ConversationFacts } from "@toki/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { conversations } from "../client";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { readFailure } from "./readFailure";

// The kind of a store entry as the permission functions of `@toki/shared` name it (plan, decision 3).
export function panelKind(
  entry: BootstrapConversation,
): ConversationFacts["kind"] {
  if (entry.kind === "dm") return "dm";
  if (entry.kind === "group_dm") return "group_dm";
  return entry.isPrivate ? "private_channel" : "public_channel";
}

// The detail of `GET /channels/{id}` is a detail for a member and a summary for someone else.
export function isFullDetail(
  read: ChannelRead,
): read is Extract<ChannelRead, { description: string | null }> {
  return "description" in read;
}

// `readChannel` calls in flight, by id (R7). The store does not make two calls for one id share a
// request, so this does: a second call while one runs gets its promise.
const inFlight = new Map<string, Promise<ChannelRead>>();

export function readChannelOnce(id: string): Promise<ChannelRead> {
  const running = inFlight.get(id);
  if (running) return running;
  const promise = conversations.readChannel(id).finally(() => {
    if (inFlight.get(id) === promise) inFlight.delete(id);
  });
  inFlight.set(id, promise);
  return promise;
}

// Reads the channel once when the caller mounts or the id changes. A failure is not shown by the
// caller: the header keeps the entry's data and the panel reads again when it opens (R7, R14).
export function useChannelRead(id: string, enabled: boolean): void {
  useEffect(() => {
    if (enabled) readChannelOnce(id).catch(() => {});
  }, [id, enabled]);
}

// The one binding of a conversation (R7): each value is asked for in its own call, with a selector
// that returns the same object or a primitive while nothing it reads changes.
export function useConversation(id: string) {
  const entry = useConversationSelector((s) => s.getConversation(id));
  const name = useConversationSelector((s) => s.getConversationName(id));
  const detail = useConversationSelector((s) => s.getChannelDetail(id));
  const memberCount = useConversationSelector((s) => s.getMemberCount(id));
  return { entry, name, detail, memberCount };
}

export type DetailRead = {
  status: "loading" | "ready" | "failed";
  error: unknown;
  retry: () => void;
};

// The panel's own read of the channel when it opens (R7, R14): it shares a request in flight with
// the header, reports a failure, hands `no_access` to the page and offers a Retry.
export function useDetailRead(
  id: string,
  enabled: boolean,
  onNoAccess: () => void,
): DetailRead {
  const [state, setState] = useState<Pick<DetailRead, "status" | "error">>({
    status: "loading",
    error: null,
  });
  const latest = useRef(onNoAccess);
  latest.current = onNoAccess;
  const run = useCallback(() => {
    setState((s) =>
      s.status === "loading" ? s : { status: "loading", error: null },
    );
    readChannelOnce(id).then(
      () => setState({ status: "ready", error: null }),
      (error: unknown) => {
        if (readFailure(error) === "no_access") latest.current();
        setState({ status: "failed", error });
      },
    );
  }, [id]);
  useEffect(() => {
    if (enabled) run();
  }, [enabled, run]);
  return { ...state, retry: run };
}
