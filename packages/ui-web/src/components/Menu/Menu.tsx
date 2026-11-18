import {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../../internal/cx";
import { focusElement } from "../../internal/overlays/focus";
import {
  markPressHandled,
  newLayerId,
  pushLayer,
  removeLayer,
  useLayerOrder,
} from "../../internal/overlays/stack";
import { computeMenuPosition } from "./menuPlace";
import "./Menu.css";

export const menuAligns = ["end", "start"] as const;
export type MenuAlign = (typeof menuAligns)[number];

export const menuCloseReasons = ["select", "escape", "tab", "outside"] as const;
export type MenuCloseReason = (typeof menuCloseReasons)[number];

export type MenuOpenFocus = "first" | "last";

type Native = Omit<
  ComponentPropsWithoutRef<"div">,
  "role" | "aria-orientation" | "aria-label" | "aria-labelledby"
>;

type Name =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-labelledby": string; "aria-label"?: string };

export type MenuProps = Native &
  Name & {
    open: boolean;
    anchorRef: RefObject<HTMLElement | null>;
    onClose: (reason: MenuCloseReason) => void;
    align?: MenuAlign;
    openFocus?: MenuOpenFocus;
  };

// What an item needs from its Menu: the end of a choice (R21).
export const MenuContext = createContext<{ select: () => void }>({
  select: () => {},
});

function itemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

function focusStart(menu: HTMLElement, openFocus: MenuOpenFocus): void {
  const items = itemsOf(menu);
  const enabled = items.filter(
    (item) => item.getAttribute("aria-disabled") !== "true",
  );
  const target =
    enabled.length === 0
      ? items[0]
      : openFocus === "last"
        ? enabled[enabled.length - 1]
        : enabled[0];
  target?.focus();
}

export const Menu = forwardRef<HTMLDivElement, MenuProps>(
  function Menu(props, ref) {
    const {
      open,
      anchorRef,
      onClose,
      align = "end",
      openFocus = "first",
      className,
      onKeyDown,
      children,
      ...rest
    } = props;

    const [layerId] = useState(newLayerId);
    const order = useLayerOrder(open);
    const menu = useRef<HTMLDivElement | null>(null);
    const latest = useRef({ onClose, anchorRef, align, openFocus });
    useLayoutEffect(() => {
      latest.current = { onClose, anchorRef, align, openFocus };
    });

    const setMenu = useCallback(
      (node: HTMLDivElement | null) => {
        menu.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const place = useCallback(() => {
      const el = menu.current;
      if (!el) return;
      const anchor = latest.current.anchorRef.current;
      const a = anchor
        ? anchor.getBoundingClientRect()
        : { left: 0, top: 0, right: 0, bottom: 0 };
      const m = el.getBoundingClientRect();
      const { left, top } = computeMenuPosition({
        anchor: { left: a.left, top: a.top, right: a.right, bottom: a.bottom },
        menu: { width: m.width, height: m.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align: latest.current.align,
      });
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    }, []);

    // The stack entry (R9): Esc moves focus to the anchor and reports escape.
    useLayoutEffect(() => {
      if (!open) return;
      pushLayer({
        id: layerId,
        order,
        kind: "menu",
        close: () => {
          focusElement(latest.current.anchorRef.current);
          latest.current.onClose("escape");
        },
        getNode: () => menu.current,
      });
      return () => removeLayer(layerId);
    }, [open, layerId, order]);

    // R20: focus on the first item when it opens.
    useLayoutEffect(() => {
      if (!open || !menu.current) return;
      focusStart(menu.current, latest.current.openFocus);
    }, [open]);

    // After every render: the position (R23) and, when the item that held focus
    // has gone, the first item (R21).
    useLayoutEffect(() => {
      if (!open || !menu.current) return;
      place();
      if (document.activeElement === document.body) {
        focusStart(menu.current, "first");
      }
    });

    // The position follows the window and any scroll (R23).
    useEffect(() => {
      if (!open) return;
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
      return () => {
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      };
    }, [open, place]);

    // A press outside, not on the anchor (R22). Capture phase on document, so
    // the mark is set before the scrim of a dialog below sees the press (R10).
    useEffect(() => {
      if (!open) return;
      const onDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (menu.current?.contains(target)) return;
        if (latest.current.anchorRef.current?.contains(target)) return;
        markPressHandled(event);
        latest.current.onClose("outside");
      };
      document.addEventListener("pointerdown", onDown, true);
      return () => document.removeEventListener("pointerdown", onDown, true);
    }, [open]);

    // When it has closed and focus is on the body, the anchor gets it (R22).
    // The cleanup also runs on unmount while open: R13 is followed and focus
    // is returned; the Errors section of the spec ("no focus is returned") is
    // to be corrected in a spec change.
    useEffect(() => {
      if (!open) return;
      return () => {
        if (document.activeElement === document.body)
          focusElement(latest.current.anchorRef.current);
      };
    }, [open]);

    const context = useMemo(
      () => ({
        select: () => {
          focusElement(latest.current.anchorRef.current);
          latest.current.onClose("select");
        },
      }),
      [],
    );

    if (!open) return null;

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const el = menu.current;
      if (!el) return;
      if (event.key === "Tab") {
        event.preventDefault();
        focusElement(anchorRef.current);
        onClose("tab");
        return;
      }
      const items = itemsOf(el);
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      let next: number;
      if (event.key === "ArrowDown") next = (index + 1) % items.length;
      else if (event.key === "ArrowUp")
        next = index <= 0 ? items.length - 1 : index - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;
      event.preventDefault();
      items[next]!.focus();
    };

    return createPortal(
      <MenuContext.Provider value={context}>
        <div
          {...rest}
          ref={setMenu}
          role="menu"
          data-menu=""
          aria-orientation="vertical"
          className={cx("menu", className)}
          onKeyDown={handleKeyDown}
        >
          {children}
        </div>
      </MenuContext.Provider>,
      document.body,
    );
  },
);
