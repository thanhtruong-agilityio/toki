import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Switch.css";

type NativeProps = Omit<
  ComponentPropsWithoutRef<"button">,
  | "type"
  | "role"
  | "children"
  | "onChange"
  | "onClick"
  | "aria-checked"
  | "aria-label"
  | "aria-labelledby"
>;

// A name is required, as `label` or as `labelledBy` (R14).
export type SwitchProps = NativeProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
} & (
    | { label: string; labelledBy?: never }
    | { labelledBy: string; label?: never }
  );

// The component keeps no state: `checked` is always the caller's (D-111).
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    { checked, onChange, label, labelledBy, className, ...rest },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-labelledby={labelledBy}
        className={cx("sw", className)}
        onClick={() => onChange(!checked)}
      />
    );
  },
);
