import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useRef, useState } from "react";
import { ConfirmAction } from "../../patterns";
import { api } from "./deps";
import { useNoAccess } from "./noAccess";
import { removePerson, type RemoveTarget } from "./useRemoveMember";

export type RemoveMemberDialogProps = {
  conversationId: string;
  // The channel's name, for the description.
  channel: string;
  isPrivate: boolean;
  target: RemoveTarget | null;
  onClose: () => void;
  // Runs the reload of R14 after a removal, and after a 409 as well (R13).
  onRemoved: () => void;
};

// One confirmation for the whole list (R11): it names the person, has no Undo and no second pattern.
export function RemoveMemberDialog({
  conversationId,
  channel,
  isPrivate,
  target,
  onClose,
  onRemoved,
}: RemoveMemberDialogProps) {
  const { t } = useTranslation();
  const { show } = useToasts();
  const onNoAccess = useNoAccess();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // The last target stays while the dialog closes: `ConfirmDialog` refuses a blank name.
  const last = useRef<RemoveTarget | null>(null);
  if (target) last.current = target;
  const shown = target ?? last.current;
  if (!shown) return null;

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await removePerson({
      conversationId,
      userId: shown.person.id,
      removeMember: (id, userId) => api.channels.removeMember(id, userId),
    });
    busyRef.current = false;
    setBusy(false);
    switch (result.kind) {
      case "removed":
        onClose();
        onRemoved();
        return;
      case "stale":
        onClose();
        onRemoved();
        show({ text: t("common.error.actionFailed") });
        return;
      case "no_access":
        onClose();
        onNoAccess();
        return;
      case "failed":
        show({ text: t("common.error.actionFailed") });
        return;
      default:
        return;
    }
  };

  return (
    <ConfirmAction
      action="removeFromChannel"
      open={target !== null}
      title={t("membership.remove.title")}
      description={`${t("membership.remove.description", { channel })} ${
        isPrivate
          ? t("membership.remove.privateNotice")
          : t("membership.remove.publicNotice")
      }`}
      target={shown.person.displayName}
      confirmLabel={t("membership.remove.confirm")}
      variant="danger"
      busy={busy}
      returnFocusRef={shown.returnFocusRef}
      onConfirm={() => void confirm()}
      onCancel={() => onClose()}
    />
  );
}
