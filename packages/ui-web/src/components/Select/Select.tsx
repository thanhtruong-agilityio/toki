import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import { hasLabelText, useFieldFrame } from "../Field/FieldFrame";
import "../Field/Field.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Native = Omit<
  ComponentPropsWithoutRef<"select">,
  "id" | "className" | "children" | "aria-invalid"
> & {
  id?: string;
  className?: string;
};

type Name =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-labelledby": string; "aria-label"?: string };

// A visible label, or a name by aria-label or aria-labelledby (R16).
export type SelectProps = Native & {
  options: SelectOption[];
  fullWidth?: boolean;
  error?: string;
} & ({ label: string } | (Name & { label?: never }));

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(props, ref) {
    const {
      options,
      fullWidth,
      error,
      label,
      id: idProp,
      className,
      ...rest
    } = props;
    const frame = useFieldFrame(
      idProp,
      error,
      (rest as { "aria-describedby"?: string })["aria-describedby"],
    );
    return (
      <>
        {!hasLabelText(label) ? null : (
          <label className="lbl" htmlFor={frame.id}>
            {label}
          </label>
        )}
        <select
          {...rest}
          ref={ref}
          id={frame.id}
          aria-invalid={frame.ariaInvalid}
          aria-describedby={frame.ariaDescribedBy}
          className={cx(
            "sel",
            fullWidth && "wide",
            frame.invalid && "invalid",
            className,
          )}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {frame.errorBox}
      </>
    );
  },
);
