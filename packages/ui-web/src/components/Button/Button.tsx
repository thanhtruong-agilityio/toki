import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Button.css";

export const buttonVariants = [
  "default",
  "primary",
  "danger",
  "ghost",
  "link",
] as const;
export const buttonSizes = ["md", "sm"] as const;

export type ButtonVariant = (typeof buttonVariants)[number];
export type ButtonSize = (typeof buttonSizes)[number];

type NativeProps = Omit<ComponentPropsWithoutRef<"button">, "type">;
// `type` is the one attribute of Button's own that the caller sets (R10).
type OwnProps = NativeProps & { type?: "button" | "submit" | "reset" };

// A link button is inline text: size and fullWidth do not apply to it (R10, R11).
export type ButtonProps =
  | (OwnProps & {
      variant?: Exclude<ButtonVariant, "link">;
      size?: ButtonSize;
      fullWidth?: boolean;
    })
  | (OwnProps & { variant: "link"; size?: never; fullWidth?: never });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "md",
      fullWidth,
      type = "button",
      className,
      ...rest
    },
    ref,
  ) {
    const classes =
      variant === "link"
        ? cx("linkbtn", className)
        : cx(
            "btn",
            variant !== "default" && variant,
            size === "sm" && "sm",
            fullWidth && "wide",
            className,
          );
    return <button type={type} {...rest} ref={ref} className={classes} />;
  },
);
