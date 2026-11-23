import { useRouter } from "@tanstack/react-router";
import { useCallback, useState, type RefObject } from "react";
import { RestoreButton } from "../channel-archive";
import { BrowseChannelsDialog } from "./channels/BrowseChannelsDialog";
import { conversations, useRegisterListActions, type ListAction } from "./deps";
import { NewMessageDialog } from "./people/NewMessageDialog";

type Open =
  | { dialog: "none" }
  | {
      dialog: "browse" | "direct";
      returnFocusRef?: RefObject<HTMLElement | null>;
    };

// Holds which of the two dialogs is open, registers their openers in the registry of TOKI-033 and
// mounts both dialogs (TOKI-034 R30). At most one is open: calling an opener while the other dialog is
// open replaces it. The registry removes the openers when this unmounts, so the three controls of
// TOKI-033 are drawn only while it is mounted. TOKI-101 adds one line here: the `rowExtra` of Browse.
export function ConversationStarters() {
  const router = useRouter();
  const [open, setOpen] = useState<Open>({ dialog: "none" });

  const browseChannels = useCallback<ListAction>(
    (options) =>
      setOpen({ dialog: "browse", returnFocusRef: options?.returnFocusRef }),
    [],
  );
  const startDirect = useCallback<ListAction>(
    (options) =>
      setOpen({ dialog: "direct", returnFocusRef: options?.returnFocusRef }),
    [],
  );
  useRegisterListActions({ browseChannels, startDirect });

  const close = useCallback(() => setOpen({ dialog: "none" }), []);
  const goTo = useCallback(
    (id: string) =>
      void router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: id },
      }),
    [router],
  );
  // Browse only (TOKI-101 plan 7e): a channel that the store does not hold is read first. An
  // archived channel that the person belongs to has no entry, and the route draws its page only when
  // the store holds its detail; without the read, an id that the route has `seen` this session would
  // move to #general. A failed read does not stop the move: the route and the page read again. A
  // direct message goes straight to its address (NewMessageDialog below).
  const openChannel = useCallback(
    (id: string) => {
      if (conversations.hasConversation(id)) {
        goTo(id);
        return;
      }
      void Promise.resolve()
        .then(() => conversations.readChannel(id))
        .catch(() => {})
        .then(() => goTo(id));
    },
    [goTo],
  );
  const returnFocusRef =
    open.dialog === "none" ? undefined : open.returnFocusRef;

  return (
    <>
      <BrowseChannelsDialog
        open={open.dialog === "browse"}
        onClose={close}
        onOpenConversation={openChannel}
        returnFocusRef={returnFocusRef}
        rowExtra={(channel, reset) => (
          <RestoreButton channel={channel} onChanged={reset} />
        )}
      />
      <NewMessageDialog
        open={open.dialog === "direct"}
        onClose={close}
        onOpenConversation={goTo}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}
