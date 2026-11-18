import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Badge.css";

export const badgeVariants = ["default", "mute", "mention"] as const;
export type BadgeVariant = (typeof badgeVariants)[number];

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
  // The accessible name of the count; the digits are then hidden from a screen reader.
  label?: string;
};

// The content is shown as given: no cap, no grouping, no hiding of 0 (R20).
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "default", label, className, children, ...rest },
  ref,
) {
  const variantClass =
    variant === "mute" ? "mute" : variant === "mention" ? "mn" : false;
  return (
    <span {...rest} ref={ref} className={cx("cnt", variantClass, className)}>
      {label === undefined ? (
        children
      ) : (
        <>
          <span aria-hidden="true">{children}</span>
          <span className="sr">{label}</span>
        </>
      )}
    </span>
  );
});
