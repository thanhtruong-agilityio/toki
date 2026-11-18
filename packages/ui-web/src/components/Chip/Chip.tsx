import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Chip.css";

export const chipSizes = ["md", "sm"] as const;
export type ChipSize = (typeof chipSizes)[number];

export type ChipProps = Omit<ComponentPropsWithoutRef<"button">, "type"> & {
  size?: ChipSize;
  pressed?: boolean;
};

// The chip is styled through aria-pressed="true" only; no class for `pressed` (R13).
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { size = "md", pressed, className, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cx("chip", size === "sm" && "sm", className)}
    />
  );
});

export type ChipGroupProps = Omit<ComponentPropsWithoutRef<"div">, "role">;

export const ChipGroup = forwardRef<HTMLDivElement, ChipGroupProps>(
  function ChipGroup({ className, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        role="group"
        className={cx("chips", className)}
      />
    );
  },
);
