import { useTranslation } from "@toki/i18n/react";
import {
  DIRECT_CONVERSATION_MAX_OTHERS,
  GROUP_DM_MAX_PEOPLE,
} from "@toki/shared";
import { Button, Modal } from "@toki/ui-web";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { hasFormContent, useFormGuard, useOnlineGate } from "../../patterns";
import { conversations, personHue, useCurrentUserId, usePeople } from "../deps";
import { PeoplePicker } from "./PeoplePicker";
import { startDirect } from "./startDirect";

export type NewMessageDialogProps = {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type Failure = "deactivated" | "tooLarge" | "failed" | null;

// The state starts again at every opening: the inner component has a new key each time `open` turns
// true, so the chosen people and the search text are empty (R21).
export function NewMessageDialog(props: NewMessageDialogProps) {
  const [wasOpen, setWasOpen] = useState(props.open);
  const [session, setSession] = useState(0);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession(session + 1);
  }
  return <NewMessageForm key={session} {...props} />;
}

function NewMessageForm({
  open,
  onClose,
  onOpenConversation,
  returnFocusRef,
}: NewMessageDialogProps) {
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();
  const people = usePeople();
  const currentUserId = useCurrentUserId();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Active people other than the signed-in one, in the store's order (R21).
  const candidates = useMemo(
    () =>
      people
        .filter((p) => p.status === "active" && p.id !== currentUserId)
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          hue: personHue(p.id),
        })),
    [people, currentUserId],
  );

  // Only the chosen people count as content; the search text does not (R24, concern 4).
  const guard = useFormGuard({
    hasContent: hasFormContent({ people: selected }),
    formName: t("picker.title"),
    onClose: () => onClose(),
  });

  const start = async () => {
    if (selected.length === 0 || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    const result = await startDirect({
      ensureOnline,
      openDirect: (ids) => conversations.openDirect(ids),
      onClose,
      onOpenConversation,
      userIds: selected,
    });
    busyRef.current = false;
    if (!mounted.current) return;
    setBusy(false);
    switch (result.kind) {
      case "deactivated": {
        const gone = new Set(result.userIds);
        setSelected((ids) => ids.filter((id) => !gone.has(id)));
        setFailure("deactivated");
        try {
          await conversations.refresh();
        } catch {
          // `refresh()` never rejects (TOKI-032 R10); the dialog must not stay busy if it ever does.
        }
        return;
      }
      case "tooLarge":
        return setFailure("tooLarge");
      case "failed":
        return setFailure("failed");
      default:
        // `started` closed the dialog; `blocked` was explained by the helper's toast.
        return;
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={t("picker.title")}
        closeLabel={t("common.close")}
        returnFocusRef={returnFocusRef}
        onRequestClose={busy ? () => {} : guard.onRequestClose}
        footer={
          <>
            <Button onClick={guard.requestClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={selected.length === 0 || busy}
              aria-busy={busy ? "true" : undefined}
              onClick={() => void start()}
            >
              {t("picker.start")}
            </Button>
          </>
        }
      >
        <div onFocusCapture={guard.trackFocus}>
          <PeoplePicker
            people={candidates}
            selected={selected}
            onChange={(ids) => {
              setSelected(ids);
              setFailure(null);
            }}
            max={DIRECT_CONVERSATION_MAX_OTHERS}
            limitMessage={t("picker.limit", { count: GROUP_DM_MAX_PEOPLE })}
            searchLabel={t("picker.search.label")}
            emptyText={t("picker.empty")}
            removeLabel={(name) => t("picker.chip.remove", { name })}
          />
          {failure ? (
            <div className="gerr" role="alert">
              {failure === "deactivated"
                ? t("picker.error.deactivated")
                : failure === "tooLarge"
                  ? t("picker.limit", { count: GROUP_DM_MAX_PEOPLE })
                  : t("common.error.actionFailed")}
            </div>
          ) : null}
        </div>
      </Modal>
      {guard.discardDialog}
    </>
  );
}
