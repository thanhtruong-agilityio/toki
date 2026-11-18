import { useTranslation } from "@toki/i18n/react";
import { ConfirmDialog, type ConfirmDialogProps } from "@toki/ui-web";
import { actionPatterns, type ConfirmActionId } from "./actions";
import { useOnlineGate } from "./useOnlineGate";

export type ConfirmActionProps = Omit<ConfirmDialogProps, "cancelLabel"> & {
  action: ConfirmActionId;
};

// The confirmation of an irreversible action (D-069). The id decides the
// pattern: an id that is not a confirmation is a programming error, so it is
// thrown while rendering (R11 c), also when the types were cast away.
export function ConfirmAction({
  action,
  onConfirm,
  ...dialog
}: ConfirmActionProps) {
  const row = (
    actionPatterns as Record<string, { pattern: string } | undefined>
  )[action];
  if (row?.pattern !== "confirm") {
    throw new Error(
      `ConfirmAction: "${action}" has the pattern "${row?.pattern ?? "unknown"}" in actionPatterns, not "confirm"`,
    );
  }
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();
  return (
    <ConfirmDialog
      {...dialog}
      cancelLabel={t("common.cancel")}
      onConfirm={() => {
        // Offline: the dialog stays open and the toast explains (R18).
        if (ensureOnline()) onConfirm();
      }}
    />
  );
}
