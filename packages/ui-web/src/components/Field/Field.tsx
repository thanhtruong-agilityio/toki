import {
  forwardRef,
  type ChangeEventHandler,
  type ComponentPropsWithoutRef,
} from "react";
import { cx } from "../../internal/cx";
import { Icon, type IconName } from "../../icons";
import { hasLabelText, useFieldFrame } from "./FieldFrame";
import "./Field.css";

export const fieldVariants = ["default", "code", "search"] as const;
export type FieldVariant = (typeof fieldVariants)[number];

type Control = Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "className" | "onChange" | "aria-invalid" | "children"
> & {
  id?: string;
  className?: string;
  rows?: number;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  error?: string;
};

type Name =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-labelledby": string; "aria-label"?: string };

// Three forms (R15). (a) a visible label; (c) a name and no label; (b) the
// search box. Anything else is a type error.
export type FieldProps =
  | (Control & {
      label: string;
      variant?: "default" | "code";
      multiline?: boolean;
      icon?: never;
    })
  | (Control &
      Name & {
        label?: never;
        variant?: "default" | "code";
        multiline?: boolean;
        icon?: never;
      })
  | (Control &
      Name & {
        variant: "search";
        label?: never;
        multiline?: never;
        icon?: IconName;
      });

type Element = HTMLInputElement | HTMLTextAreaElement;

export const Field = forwardRef<Element, FieldProps>(
  function Field(props, ref) {
    const {
      label,
      variant = "default",
      multiline,
      icon,
      error,
      id: idProp,
      className,
      ...rest
    } = props;
    const describedBy = (rest as { "aria-describedby"?: string })[
      "aria-describedby"
    ];
    const frame = useFieldFrame(idProp, error, describedBy);
    const owned = {
      id: frame.id,
      "aria-invalid": frame.ariaInvalid,
      "aria-describedby": frame.ariaDescribedBy,
    };

    if (variant === "search") {
      const { disabled, readOnly } = rest;
      return (
        <>
          <label
            className={cx(
              "field",
              frame.invalid && "invalid",
              disabled && "disabled",
              readOnly && "readonly",
              className,
            )}
          >
            {icon ? <Icon name={icon} /> : null}
            <input
              {...rest}
              {...owned}
              ref={ref as React.Ref<HTMLInputElement>}
            />
          </label>
          {frame.errorBox}
        </>
      );
    }

    const controlClass = cx(
      "inp",
      variant === "code" && "code",
      frame.invalid && "invalid",
      className,
    );
    const control = multiline ? (
      <textarea
        {...(rest as ComponentPropsWithoutRef<"textarea">)}
        {...owned}
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={controlClass}
      />
    ) : (
      <input
        {...rest}
        {...owned}
        ref={ref as React.Ref<HTMLInputElement>}
        className={controlClass}
      />
    );
    return (
      <>
        {!hasLabelText(label) ? null : (
          <label className="lbl" htmlFor={frame.id}>
            {label}
          </label>
        )}
        {control}
        {frame.errorBox}
      </>
    );
  },
);
