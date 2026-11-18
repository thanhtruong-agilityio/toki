import {
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";
import { cx } from "../../internal/cx";
import { Icon, type IconName } from "../../icons";
import { MenuContext } from "./Menu";

export const menuItemVariants = ["default", "danger"] as const;
export type MenuItemVariant = (typeof menuItemVariants)[number];

export type MenuItemProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "type" | "role" | "tabIndex" | "disabled"
> & {
  icon?: IconName;
  variant?: MenuItemVariant;
  // Sets aria-disabled, not the attribute: the item stays focusable (R18).
  disabled?: boolean;
};

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  function MenuItem(
    {
      icon,
      variant = "default",
      disabled,
      className,
      onClick,
      children,
      ...rest
    },
    ref,
  ) {
    const menu = useContext(MenuContext);
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(event);
      // A handler that keeps the menu open calls preventDefault (R21).
      if (!event.defaultPrevented) menu.select();
    };
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled ? true : undefined}
        className={cx(variant === "danger" && "dng", className) || undefined}
        onClick={handleClick}
      >
        {icon ? <Icon name={icon} /> : null}
        <span>{children}</span>
      </button>
    );
  },
);
