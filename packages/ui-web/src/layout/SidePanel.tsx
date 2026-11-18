import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "../components/IconButton";
import "./shell.css";

export type SidePanelProps = {
  title: string;
  subtitle?: string;
  // Already translated; the shell holds no text (R2).
  labels: { back: string; close: string };
  onClose: () => void;
  children?: ReactNode;
};

// The header and the body of a side panel, drawn inside the `aside.side` that
// `AppShell` owns (R11). It takes no `ref`. Which button shows depends on the
// width (the back button under 720 px, the close button from 720 px).
//
// Escape closes it only when no layer took the event: it listens on `document`
// in the bubble phase, so menus and dialogs, which stop the event (TOKI-014
// R9), come first. Another layer, such as a mention popup or an edit in place,
// must call `preventDefault` or `stopPropagation` on its Escape to come first.
export function SidePanel({
  title,
  subtitle,
  labels,
  onClose,
  children,
}: SidePanelProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented || event.isComposing) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <>
      <div className="sh">
        <IconButton
          className="back-side"
          icon="left"
          label={labels.back}
          onClick={() => onClose()}
        />
        <h2 className="ell">
          {title}
          {subtitle !== undefined && <span className="muted">{subtitle}</span>}
        </h2>
        <IconButton
          className="closex"
          size="sm"
          icon="x"
          label={labels.close}
          onClick={() => onClose()}
        />
      </div>
      <div className="sb">{children}</div>
    </>
  );
}
