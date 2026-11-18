import { useTranslation } from "@toki/i18n/react";
import { ConfirmDialog, type DialogCloseReason } from "@toki/ui-web";
import {
  useCallback,
  useRef,
  useState,
  type FocusEvent,
  type ReactElement,
} from "react";
import { GUARD_ESCAPE } from "./guardEscape";

export type FormClose = DialogCloseReason | "discard";

export type FormGuardOptions = {
  // Computed by the screen, usually with `hasFormContent` (R23).
  hasContent: boolean;
  // The name of the form, shown in the discard question.
  formName: string;
  // The owner's way to set `open` to false.
  onClose: (reason: FormClose) => void;
};

export type FormGuard = {
  onRequestClose: (reason: DialogCloseReason) => void;
  requestClose: () => void;
  // Always an element: it stays mounted so that closing it can return focus.
  discardDialog: ReactElement;
  trackFocus: (event: FocusEvent<HTMLElement>) => void;
};

// A form that has content is not thrown away by a stray press (D-070): an outside
// press does nothing, and closing it by a button asks whether to discard.
export function useFormGuard({
  hasContent,
  formName,
  onClose,
}: FormGuardOptions): FormGuard {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  // The close request reaches the guard from the Modal and not from a button, and
  // in Safari and Firefox on macOS a press does not focus a button, so the guard
  // keeps the last element of the form that had focus (R22).
  const lastFocus = useRef<HTMLElement | null>(null);

  const onRequestClose = useCallback(
    (reason: DialogCloseReason) => {
      if (!hasContent) return onClose(reason);
      if (reason === "outside") {
        // A press on the scrim takes focus away from the field; the form stays
        // as it was, so focus goes back (D-070, R21).
        const field = lastFocus.current;
        if (field?.isConnected) field.focus();
        return;
      }
      if (reason === "escape" && GUARD_ESCAPE === "ignore") return;
      setAsking(true);
    },
    [hasContent, onClose],
  );

  const requestClose = useCallback(
    () => onRequestClose("close"),
    [onRequestClose],
  );

  const trackFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    lastFocus.current = event.target;
  }, []);

  const discardDialog = (
    <ConfirmDialog
      open={asking}
      title={t("common.discard.title")}
      description={t("common.discard.message", { name: formName })}
      target={formName}
      confirmLabel={t("common.discard.confirm")}
      cancelLabel={t("common.discard.keep")}
      variant="danger"
      returnFocusRef={lastFocus}
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        onClose("discard");
      }}
    />
  );

  return { onRequestClose, requestClose, discardDialog, trackFocus };
}
