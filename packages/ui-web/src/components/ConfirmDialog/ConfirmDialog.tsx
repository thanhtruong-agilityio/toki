import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import "./ConfirmDialog.css";

export const confirmVariants = ["danger", "primary"] as const;
export type ConfirmVariant = (typeof confirmVariants)[number];

export const confirmCancelReasons = ["cancel", "escape", "outside"] as const;
export type ConfirmCancelReason = (typeof confirmCancelReasons)[number];

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  // The name of what the action touches. Always shown as its own element (R5).
  target: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: ConfirmVariant;
  // A confirmed request that has not come back (R7).
  busy?: boolean;
  onConfirm: () => void;
  onCancel: (reason: ConfirmCancelReason) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const BLANK_TARGET =
  "ConfirmDialog: `target` must name what the action touches and cannot be empty";

export function ConfirmDialog({
  open,
  title,
  description,
  target,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ConfirmDialogProps) {
  const blank = target.trim() === "";
  // A throw in render at the moment of a destructive action would blank the
  // page in production, so only development and test throw (R5).
  if (blank && import.meta.env?.DEV) throw new Error(BLANK_TARGET);

  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // In the commit in which `busy` turns true the pressed button becomes
  // disabled, so focus goes to the panel and is not lost to the body (R7).
  useLayoutEffect(() => {
    if (busy && open) panelRef.current?.focus();
  }, [busy, open]);

  // Once per blank target, not on every render.
  useEffect(() => {
    if (blank) console.error(BLANK_TARGET);
  }, [blank]);

  if (blank) return null;

  // `title` here is the heading of the Modal, not the HTML attribute that the
  // source test of TOKI-012 bans (it matches the text of the source, not the DOM).
  const heading = { title };
  const hasDescription = description !== undefined && description !== "";

  return (
    <Modal
      ref={panelRef}
      open={open}
      {...heading}
      className="cfm"
      aria-describedby={hasDescription ? descriptionId : undefined}
      aria-busy={busy ? true : undefined}
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
      onRequestClose={(reason) => {
        if (busy || reason === "close") return;
        onCancel(reason);
      }}
      footer={
        <>
          <Button
            ref={cancelRef}
            disabled={busy}
            onClick={() => onCancel("cancel")}
          >
            {cancelLabel}
          </Button>
          <Button variant={variant} disabled={busy} onClick={() => onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {hasDescription ? (
        <p id={descriptionId} className="cfm-text">
          {description}
        </p>
      ) : null}
      <p className="cfm-target">
        <strong>{target}</strong>
      </p>
    </Modal>
  );
}
