import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { MenuCloseReason, MenuOpenFocus } from "./Menu";

export type MenuTriggerProps<T extends HTMLElement> = {
  ref: RefObject<T | null>;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<T>) => void;
};

export type MenuTriggerMenuProps<T extends HTMLElement> = {
  open: boolean;
  anchorRef: RefObject<T | null>;
  openFocus: MenuOpenFocus;
  onClose: (reason?: MenuCloseReason) => void;
};

// The trigger's props hold none of children, className, type and aria-label, so
// the AppShell's button.ucard can spread them before the attributes it owns (R24).
export function useMenuTrigger<T extends HTMLElement>(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerProps: MenuTriggerProps<T>;
  menuProps: MenuTriggerMenuProps<T>;
} {
  const ref = useRef<T | null>(null);
  const [open, setOpen] = useState(false);
  const [openFocus, setOpenFocus] = useState<MenuOpenFocus>("first");

  const onClick = useCallback(() => {
    setOpenFocus("first");
    setOpen((value) => !value);
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<T>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpenFocus(event.key === "ArrowDown" ? "first" : "last");
    setOpen(true);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  return {
    open,
    setOpen,
    triggerProps: {
      ref,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      onClick,
      onKeyDown,
    },
    menuProps: { open, anchorRef: ref, openFocus, onClose },
  };
}
