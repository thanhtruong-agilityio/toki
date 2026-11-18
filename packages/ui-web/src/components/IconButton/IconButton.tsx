import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import { Icon, type IconName } from "../../internal/icon-stand-in";
import "./IconButton.css";

export const iconButtonSizes = ["md", "sm"] as const;
export type IconButtonSize = (typeof iconButtonSizes)[number];

// `label` is the only name: aria-label, type and children are not accepted (R12).
export type IconButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "type" | "aria-label" | "children"
> & {
  icon: IconName;
  label: string;
  size?: IconButtonSize;
  pressed?: boolean;
  // A hyphenated attribute is not checked by JSX unless it is declared, so the
  // refusal of R12 is declared here.
  "aria-label"?: never;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon, label, size = "md", pressed, className, ...rest },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={cx(
          "ib",
          size === "sm" && "sm",
          pressed === true && "on",
          className,
        )}
      >
        <Icon name={icon} />
      </button>
    );
  },
);
