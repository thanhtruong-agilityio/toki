import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../internal/cx";
import "./shell.css";

type ListOwned = "role" | "aria-label";

export type TabListProps = Omit<ComponentPropsWithoutRef<"div">, ListOwned> & {
  // Already translated, and required (R13).
  "aria-label": string;
};

const scrollIntoView = (el: Element) =>
  el.scrollIntoView?.({ inline: "nearest", block: "nearest" });

// The WAI-ARIA tabs pattern with manual activation (R14): the arrows, Home and
// End move focus and select nothing; Enter, Space and a click select (the
// button's own click). A tab may load data, so a key press must not fire a load
// for each tab passed.
export const TabList = forwardRef<HTMLDivElement, TabListProps>(
  function TabList({ className, onKeyDown, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        className={cx("tabs", className)}
        role="tablist"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) moveFocus(event);
        }}
      />
    );
  },
);

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
  ];
  const from = tabs.findIndex((tab) => tab === document.activeElement);
  if (tabs.length === 0 || from < 0) return;
  const last = tabs.length - 1;
  const to =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowRight"
          ? (from + 1) % tabs.length
          : (from + last) % tabs.length;
  event.preventDefault();
  const target = tabs[to]!;
  target.focus();
  scrollIntoView(target);
}

export type TabProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "type" | "role" | "id" | "aria-selected" | "aria-controls" | "tabIndex"
> & {
  id: string;
  selected: boolean;
  // The id of the screen's panel for this tab.
  panelId?: string;
  onSelect: () => void;
  children?: ReactNode;
};

// One tab: text, an icon or a count as children; it sets no text itself (R13).
export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { id, selected, panelId, onSelect, className, onClick, ...rest },
  ref,
) {
  const own = useRef<HTMLButtonElement | null>(null);
  // A change of the selected tab brings it into view (R14).
  useEffect(() => {
    if (selected && own.current) scrollIntoView(own.current);
  }, [selected]);
  return (
    <button
      {...rest}
      ref={(node) => {
        own.current = node;
        setRef(ref, node);
      }}
      className={cx("tab", className)}
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect();
      }}
    />
  );
});

function setRef<T>(ref: Ref<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}
