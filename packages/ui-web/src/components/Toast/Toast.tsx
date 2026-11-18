import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Toast.css";

export type ToastAction = { label: string; onPress: () => void };

export type ToastProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "role"
> & {
  text: string;
  action?: ToastAction;
};

// One box, with no timer and no state (R19). It has no role: the region is
// the live region, and a role added with the node is not announced as a change.
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { text, action, className, ...rest },
  ref,
) {
  // Removed even when a caller casts them in (R4).
  const {
    children: _children,
    role: _role,
    ...others
  } = rest as typeof rest & Record<string, unknown>;
  void [_children, _role];
  return (
    <div {...others} ref={ref} className={cx("toast", className)}>
      <span>{text}</span>
      {action ? (
        <button type="button" onClick={action.onPress}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
});
