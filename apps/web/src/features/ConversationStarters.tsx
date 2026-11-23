import { useRouter } from "@tanstack/react-router";
import { useCallback, useState, type RefObject } from "react";
import { BrowseChannelsDialog } from "./channels/BrowseChannelsDialog";
import { useRegisterListActions, type ListAction } from "./deps";
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
  const openConversation = useCallback(
    (id: string) => {
      void router.navigate({
        to: "/c/$conversationId",
        params: { conversationId: id },
      });
    },
    [router],
  );
  const returnFocusRef =
    open.dialog === "none" ? undefined : open.returnFocusRef;

  return (
    <>
      <BrowseChannelsDialog
        open={open.dialog === "browse"}
        onClose={close}
        onOpenConversation={openConversation}
        returnFocusRef={returnFocusRef}
      />
      <NewMessageDialog
        open={open.dialog === "direct"}
        onClose={close}
        onOpenConversation={openConversation}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}
