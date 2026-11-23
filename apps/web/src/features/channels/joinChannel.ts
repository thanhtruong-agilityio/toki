import { ErrorCodes } from "@toki/shared";
import { ApiError } from "../deps";

export type JoinResult =
  | { kind: "joined" }
  // The connection is down: the helper's toast explained, nothing was sent.
  | { kind: "blocked" }
  // 409 `channel_archived`: the channel was archived since the list was read (D-131: a fresh copy).
  | { kind: "archived" }
  | { kind: "failed" };

export type JoinInput = {
  id: string;
  name: string;
  ensureOnline: () => boolean;
  // The store's `joinChannel`: it stores the entry when the answer comes.
  join: (id: string) => Promise<void>;
  show: (toast: { text: string }) => unknown;
  t: (key: "browse.joined", params: { name: string }) => string;
  // False once the screen that asked has gone: the store is still updated and the toast still shown,
  // but nobody is told to navigate (the person may have gone elsewhere).
  isMounted: () => boolean;
  onJoined: () => void;
};

// The steps of R11 as a plain function: it calls no hook, so it works after the dialog has unmounted.
export async function joinChannel({
  id,
  name,
  ensureOnline,
  join,
  show,
  t,
  isMounted,
  onJoined,
}: JoinInput): Promise<JoinResult> {
  if (!ensureOnline()) return { kind: "blocked" };
  try {
    await join(id);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.kind === "http" &&
      error.status === 409 &&
      error.code === ErrorCodes.channelArchived
    ) {
      return { kind: "archived" };
    }
    return { kind: "failed" };
  }
  if (isMounted()) onJoined();
  show({ text: t("browse.joined", { name }) });
  return { kind: "joined" };
}
