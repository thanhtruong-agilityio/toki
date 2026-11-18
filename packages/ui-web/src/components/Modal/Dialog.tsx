import { createPortal } from "react-dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "../../internal/cx";
import {
  focusElement,
  focusInto,
  recordOpener,
  tabbables,
} from "../../internal/overlays/focus";
import { isolate } from "../../internal/overlays/isolate";
import { lockScroll, unlockScroll } from "../../internal/overlays/scrollLock";
import {
  isPressHandled,
  isTop,
  layersAbove,
  newLayerId,
  pushLayer,
  removeLayer,
  useLayerOrder,
} from "../../internal/overlays/stack";
import { IconButton } from "../IconButton/IconButton";
import "./Modal.css";

export const dialogBackdrops = ["dim", "opaque"] as const;
export type DialogBackdrop = (typeof dialogBackdrops)[number];

export const dialogCloseReasons = ["escape", "outside", "close"] as const;
export type DialogCloseReason = (typeof dialogCloseReasons)[number];

type Native = Omit<
  ComponentPropsWithoutRef<"div">,
  | "title"
  | "role"
  | "aria-modal"
  | "tabIndex"
  | "aria-label"
  | "aria-labelledby"
>;

// Form (a) has a `title`; form (b) has a name by aria-label or aria-labelledby
// and no header (R5, R32).
type Named =
  | {
      title: string;
      closeLabel?: string;
      footer?: ReactNode;
      "aria-label"?: never;
      "aria-labelledby"?: never;
    }
  | ({
      title?: never;
      closeLabel?: never;
      footer?: never;
    } & (
      | { "aria-label": string; "aria-labelledby"?: string }
      | { "aria-labelledby": string; "aria-label"?: string }
    ));

export type ModalProps = Native &
  Named & {
    open: boolean;
    onRequestClose: (reason: DialogCloseReason) => void;
    initialFocusRef?: RefObject<HTMLElement | null>;
    backdrop?: DialogBackdrop;
    returnFocus?: boolean;
    returnFocusRef?: RefObject<HTMLElement | null>;
  };

// `sheet` is set by Sheet only; the package does not export this component.
export type DialogProps = ModalProps & { sheet?: boolean };

export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  function Dialog(props, ref) {
    const {
      open,
      onRequestClose,
      initialFocusRef,
      backdrop = "dim",
      returnFocus = true,
      returnFocusRef,
      sheet,
      title,
      closeLabel,
      footer,
      className,
      children,
      onKeyDown,
      "aria-labelledby": labelledBy,
      ...rest
    } = props;

    const titleId = useId();
    const [layerId] = useState(newLayerId);
    const order = useLayerOrder(open);
    const scrim = useRef<HTMLDivElement | null>(null);
    const panel = useRef<HTMLDivElement | null>(null);
    const session = useRef<{ opener: HTMLElement | null } | null>(null);
    const pressStarted = useRef(false);

    // Handlers and options are read through this ref, so the effects depend on
    // `open` only (decision 6).
    const latest = useRef({ onRequestClose, returnFocus, returnFocusRef });
    useLayoutEffect(() => {
      latest.current = { onRequestClose, returnFocus, returnFocusRef };
    });

    const setPanel = useCallback(
      (node: HTMLDivElement | null) => {
        panel.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // The stack entry, first, so that the focus step below can ask isTop.
    useLayoutEffect(() => {
      if (!open) return;
      pushLayer({
        id: layerId,
        order,
        kind: "dialog",
        close: (reason) => latest.current.onRequestClose(reason),
        getNode: () => panel.current,
      });
      return () => removeLayer(layerId);
    }, [open, layerId, order]);

    // R33, on open: the opener, the lock, the isolation, then focus. On close,
    // in the cleanup: the isolation and the lock are released.
    useLayoutEffect(() => {
      if (!open) return;
      if (!session.current) session.current = { opener: recordOpener() };
      lockScroll();
      const release =
        backdrop === "opaque" && scrim.current ? isolate(scrim.current) : null;
      if (panel.current && isTop(layerId)) {
        focusInto(panel.current, initialFocusRef);
      }
      return () => {
        release?.();
        unlockScroll();
      };
      // `backdrop` and `initialFocusRef` are read when the dialog opens.
    }, [open]);

    // R33, on close: after React has removed the portal, focus goes back.
    useEffect(() => {
      if (!open) return;
      return () => {
        const state = session.current;
        const { returnFocus: give, returnFocusRef: ref } = latest.current;
        if (!give || !state) return;
        const target = ref?.current ?? state.opener;
        if (!target || !target.isConnected) return;
        if (document.activeElement !== document.body) return;
        focusElement(target);
      };
    }, [open]);

    // The opener of a session is forgotten only when `open` turns false, not in
    // each cleanup (StrictMode runs the effects twice, decision 5).
    useEffect(() => {
      if (!open) session.current = null;
    }, [open]);

    // A focus that lands outside the panel and outside every layer above it is
    // moved back (R12).
    useEffect(() => {
      if (!open) return;
      const onFocusIn = (event: FocusEvent) => {
        const node = panel.current;
        const target = event.target as Node | null;
        if (!node || !target || !isTop(layerId)) return;
        if (node.contains(target)) return;
        if (layersAbove(layerId).some((l) => l.getNode()?.contains(target)))
          return;
        const first = tabbables(node)[0];
        focusElement(first ?? node);
      };
      document.addEventListener("focusin", onFocusIn);
      return () => document.removeEventListener("focusin", onFocusIn);
    }, [open, layerId]);

    if (!open) return null;

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      const node = panel.current;
      if (event.key !== "Tab" || event.defaultPrevented) return;
      // The DOM, not the React tree: a Menu rendered inside sends its keys up.
      if (!node || !node.contains(event.target as Node) || !isTop(layerId))
        return;
      const list = tabbables(node);
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !list.includes(active)) {
        event.preventDefault();
        focusElement(event.shiftKey ? last : first);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        focusElement(first);
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        focusElement(last);
      }
    };

    const onScrimDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      pressStarted.current =
        event.target === event.currentTarget &&
        !isPressHandled(event.nativeEvent);
    };
    const onScrimUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      const began = pressStarted.current;
      pressStarted.current = false;
      if (began && event.target === event.currentTarget)
        onRequestClose("outside");
    };

    const hasTitle = title !== undefined;
    return createPortal(
      <div
        ref={scrim}
        className={cx(
          "scrim",
          sheet && "sheet",
          backdrop === "opaque" && "opaque",
        )}
        onPointerDown={onScrimDown}
        onPointerUp={onScrimUp}
      >
        <div
          {...rest}
          ref={setPanel}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-labelledby={hasTitle ? titleId : labelledBy}
          className={cx("modal", className)}
          onKeyDown={handleKeyDown}
        >
          {hasTitle ? (
            <>
              <div className="mhd">
                <h2 id={titleId}>{title}</h2>
                {closeLabel !== undefined ? (
                  <IconButton
                    size="sm"
                    icon="x"
                    label={closeLabel}
                    onClick={() => onRequestClose("close")}
                  />
                ) : null}
              </div>
              <div className="mbd">{children}</div>
              {footer != null ? <div className="mft">{footer}</div> : null}
            </>
          ) : (
            children
          )}
        </div>
      </div>,
      document.body,
    );
  },
);
