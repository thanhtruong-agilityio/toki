import { useTranslation } from "@toki/i18n/react";
import type { ChannelSummary } from "@toki/shared";
import { Button, EmptyState, Field, Modal } from "@toki/ui-web";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useMoreOnScroll } from "../useMoreOnScroll";
import { BrowseRow } from "./BrowseRow";
import { useBrowsePages } from "./useBrowsePages";
import { useJoinChannel } from "./useJoinChannel";
import "../rows.css";

export type BrowseChannelsDialogProps = {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  // The starting text of the search, for the command palette (TOKI-071).
  initialSearch?: string;
  // The one place where another ticket adds a control to a row (TOKI-101's "Restore"): called for each
  // row with the channel and the dialog's `reset`, the result is drawn after the row's own button.
  rowExtra?: (channel: ChannelSummary, reset: () => void) => ReactNode;
};

// Find and join a channel (TOKI-034 R4 to R15). The dialog never closes itself: it calls `onClose()` for
// every close request, because a search text is not form content (concern 4), and after a join or an
// Open. The body is mounted only while the dialog is open, so nothing is asked while it is closed and
// every opening starts again.
export function BrowseChannelsDialog({
  open,
  onClose,
  onOpenConversation,
  returnFocusRef,
  initialSearch,
  rowExtra,
}: BrowseChannelsDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={t("browse.title")}
      closeLabel={t("common.close")}
      returnFocusRef={returnFocusRef}
      onRequestClose={() => onClose()}
    >
      {open ? (
        <BrowseBody
          onClose={onClose}
          onOpenConversation={onOpenConversation}
          initialSearch={initialSearch ?? ""}
          rowExtra={rowExtra}
        />
      ) : null}
    </Modal>
  );
}

function BrowseBody({
  onClose,
  onOpenConversation,
  initialSearch,
  rowExtra,
}: {
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  initialSearch: string;
  rowExtra: BrowseChannelsDialogProps["rowExtra"];
}) {
  const { t } = useTranslation();
  const join = useJoinChannel();
  const [text, setText] = useState(initialSearch);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinFailed, setJoinFailed] = useState(false);
  const pages = useBrowsePages(text);
  const mounted = useRef(false);
  const joining = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const more = useMoreOnScroll({
    enabled: pages.hasMore && !pages.loadingMore && !pages.moreFailed,
    onMore: pages.more,
  });
  const container = more.ref;
  const resetPages = pages.reset;
  // The list returns to its first page, is asked again and the container scrolls to the top (R13).
  const reset = useCallback(() => {
    if (!mounted.current) return;
    resetPages();
    if (container.current) container.current.scrollTop = 0;
  }, [resetPages, container]);

  const press = async (channel: ChannelSummary) => {
    if (joining.current) return;
    joining.current = true;
    setJoinFailed(false);
    setJoiningId(channel.id);
    const result = await join({
      id: channel.id,
      name: channel.name,
      isMounted: () => mounted.current,
      onJoined: () => {
        onClose();
        onOpenConversation(channel.id);
      },
    });
    joining.current = false;
    if (!mounted.current) return;
    setJoiningId(null);
    if (result.kind === "archived") reset();
    else if (result.kind === "failed") setJoinFailed(true);
  };

  const empty = pages.state === "ready" && pages.channels.length === 0;
  const busy = pages.state === "loading" || pages.loadingMore;

  return (
    <>
      <Field
        variant="search"
        type="search"
        aria-label={t("browse.search.label")}
        placeholder={t("browse.search.label")}
        maxLength={80}
        data-autofocus
        value={text}
        onChange={(
          event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => setText(event.target.value)}
      />
      {joinFailed ? (
        <div className="gerr" role="alert">
          {t("common.error.actionFailed")}
        </div>
      ) : null}
      <div
        {...more}
        className={empty ? "mlist is-empty" : "mlist"}
        aria-busy={busy ? "true" : undefined}
      >
        {pages.state === "loading" ? (
          <p className="muted">{t("browse.loading")}</p>
        ) : pages.state === "error" ? (
          <>
            <p className="muted">{t("browse.error.load")}</p>
            <Button size="sm" onClick={pages.retry}>
              {t("browse.error.retry")}
            </Button>
          </>
        ) : empty ? (
          <EmptyState icon="hash" title={t("browse.empty")} description="" />
        ) : (
          <>
            <ul>
              {pages.channels.map((channel) => (
                <BrowseRow
                  key={channel.id}
                  channel={channel}
                  joinDisabled={joiningId !== null}
                  joining={joiningId === channel.id}
                  onOpen={() => {
                    onClose();
                    onOpenConversation(channel.id);
                  }}
                  onJoin={() => void press(channel)}
                  extra={rowExtra?.(channel, reset)}
                />
              ))}
            </ul>
            {pages.moreFailed ? (
              <>
                <p className="muted">{t("browse.error.load")}</p>
                <Button size="sm" onClick={pages.retry}>
                  {t("browse.error.retry")}
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
