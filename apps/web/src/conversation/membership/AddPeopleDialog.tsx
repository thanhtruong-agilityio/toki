import { useTranslation } from "@toki/i18n/react";
import { CHANNEL_MEMBERS_ADD_MAX } from "@toki/shared";
import { Button, Modal, useToasts } from "@toki/ui-web";
import { useMemo, useRef, useState, type RefObject } from "react";
import { hasFormContent, useFormGuard, useOnlineGate } from "../../patterns";
import { candidatesFor } from "./candidates";
import {
  api,
  conversations,
  PeoplePicker,
  personHue,
  useChannelName,
  useCurrentUserId,
  usePeople,
} from "./deps";
import { useNoAccess } from "./noAccess";
import { addPeople } from "./useAddPeople";

export type AddPeopleDialogProps = {
  open: boolean;
  onClose: () => void;
  // Called once after a successful add, before `onClose` (R8).
  onAdded: () => void;
  conversationId: string;
  // The ids of every member of the channel (`members.ids` of the `Controls` contract).
  memberIds: readonly string[];
  returnFocusRef?: RefObject<HTMLElement | null>;
};

// The dialog's state starts again at every opening: the inner form has a new key each time
// `open` turns true, so the picker is a new instance and holds no old text (R7).
export function AddPeopleDialog(props: AddPeopleDialogProps) {
  const [wasOpen, setWasOpen] = useState(props.open);
  const [session, setSession] = useState(0);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession(session + 1);
  }
  return <AddPeopleForm key={session} {...props} />;
}

function AddPeopleForm({
  open,
  onClose,
  onAdded,
  conversationId,
  memberIds,
  returnFocusRef,
}: AddPeopleDialogProps) {
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();
  const { show } = useToasts();
  const onNoAccess = useNoAccess();
  const people = usePeople();
  const userId = useCurrentUserId();
  const name = useChannelName(conversationId);

  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<"inactive" | "actionFailed" | null>(
    null,
  );
  const busyRef = useRef(false);

  const candidates = useMemo(
    () => candidatesFor({ people, memberIds, userId }),
    [people, memberIds, userId],
  );
  const pickerPeople = useMemo(
    () =>
      candidates.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        hue: personHue(p.id),
      })),
    [candidates],
  );

  const guard = useFormGuard({
    hasContent: hasFormContent({ people: selected }),
    formName: t("membership.add.title", { name }),
    onClose: () => onClose(),
  });

  const settle = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const submit = async () => {
    if (selected.length === 0 || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    const result = await addPeople({
      conversationId,
      userIds: selected,
      ensureOnline,
      addMembers: (id, ids) => api.channels.addMembers(id, ids),
    });
    switch (result.kind) {
      case "added":
        busyRef.current = false;
        onAdded();
        onClose();
        return;
      case "inactive": {
        try {
          await conversations.refresh();
        } catch {
          // `refresh()` never rejects (TOKI-032 R10); the dialog must not stay busy if it does.
        }
        const stillOffered = new Set(
          candidatesFor({
            people: conversations.getPeople(),
            memberIds,
            userId,
          }).map((p) => p.id),
        );
        setSelected((ids) => ids.filter((id) => stillOffered.has(id)));
        setFailure("inactive");
        return settle();
      }
      case "stale":
        try {
          await conversations.readChannel(conversationId);
        } catch {
          // The panel's own read shows its state.
        }
        busyRef.current = false;
        onClose();
        show({ text: t("common.error.actionFailed") });
        return;
      case "no_access":
        busyRef.current = false;
        onClose();
        onNoAccess();
        return;
      case "failed":
        setFailure("actionFailed");
        return settle();
      default:
        // `blocked` (the toast explained) and `silent`.
        return settle();
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={t("membership.add.title", { name })}
        closeLabel={busy ? undefined : t("common.close")}
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
              onClick={() => void submit()}
            >
              {t("membership.add.confirm")}
            </Button>
          </>
        }
      >
        <div onFocusCapture={guard.trackFocus}>
          <PeoplePicker
            people={pickerPeople}
            selected={selected}
            onChange={setSelected}
            max={CHANNEL_MEMBERS_ADD_MAX}
            limitMessage={t("membership.add.limit", {
              count: CHANNEL_MEMBERS_ADD_MAX,
            })}
            searchLabel={t("picker.search.label")}
            removeLabel={(personName) =>
              t("picker.chip.remove", { name: personName })
            }
            emptyText={
              candidates.length === 0
                ? t("membership.add.nobody")
                : t("picker.empty")
            }
          />
          {failure ? (
            <div className="gerr" role="alert">
              {failure === "inactive"
                ? t("membership.add.error.inactive")
                : t("common.error.actionFailed")}
            </div>
          ) : null}
        </div>
      </Modal>
      {guard.discardDialog}
    </>
  );
}
