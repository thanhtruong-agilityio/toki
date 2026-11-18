import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import { Toast } from "./Toast";
import { useToastList } from "./ToastProvider";
import "./Toast.css";

export type ToastRegionProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "aria-live" | "children"
>;

// The one live region of the toasts (R19, R21). It is in the document from
// the first render, so that a screen reader announces a toast added later.
export const ToastRegion = forwardRef<HTMLDivElement, ToastRegionProps>(
  function ToastRegion({ className, style, ...rest }, ref) {
    const { items, api, hold } = useToastList();
    const {
      "aria-live": _live,
      children: _children,
      ...others
    } = rest as typeof rest & Record<string, unknown>;
    void [_live, _children];
    return (
      <div
        {...others}
        ref={ref}
        className={cx("toasts", className)}
        style={{ ...style, bottom: 20 }}
        aria-live="polite"
      >
        {items.map((item) => (
          <Toast
            key={item.id}
            text={item.text}
            action={
              item.action && {
                label: item.action.label,
                // The toast goes first, then the caller's code (R24).
                onPress: () => {
                  api.dismiss(item.id);
                  item.action!.onPress();
                },
              }
            }
            onPointerEnter={() => hold(item.id, "pointer", true)}
            onPointerLeave={() => hold(item.id, "pointer", false)}
            onFocus={() => hold(item.id, "focus", true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                hold(item.id, "focus", false);
              }
            }}
          />
        ))}
      </div>
    );
  },
);
