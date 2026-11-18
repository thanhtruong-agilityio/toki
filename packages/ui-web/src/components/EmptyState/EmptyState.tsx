import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "../../icons";
import { cx } from "../../internal/cx";
import "./EmptyState.css";

export type EmptyStateProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "title" | "children" | "role"
> & {
  icon: IconName;
  // The texts are written by each list (D-074); the component owns none (R3).
  title: string;
  description: string;
  // A button or a link, drawn by the caller.
  action?: ReactNode;
  // The list was emptied by a search or a filter: the empty state is then a
  // status that a screen reader announces (concern 11).
  filtered?: boolean;
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { icon, title, description, action, filtered, className, ...rest },
    ref,
  ) {
    // Removed even when a caller casts them in (R18).
    const {
      children: _children,
      title: _title,
      role: _role,
      ...others
    } = rest as typeof rest & Record<string, unknown>;
    void [_children, _title, _role];
    return (
      <div
        {...others}
        ref={ref}
        className={cx("empty", className)}
        role={filtered ? "status" : undefined}
      >
        <div className="eic">
          <Icon name={icon} size={26} />
        </div>
        <b>{title}</b>
        <span>{description}</span>
        {action}
      </div>
    );
  },
);
