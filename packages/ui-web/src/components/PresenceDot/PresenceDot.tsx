import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./PresenceDot.css";

// Three states (R11): there is no 'in a Meet' state before phase 4 and no
// offline state (D-036).
export const presenceStates = ["active", "away", "dnd"] as const;
export type PresenceState = (typeof presenceStates)[number];

export type PresenceDotProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "role" | "aria-label" | "aria-hidden" | "children"
> & {
  state: PresenceState;
  // The word for the state, written by the caller (R14). A dot with no word
  // next to it must be given one: Active and Do not disturb differ by colour.
  label?: string;
};

export const PresenceDot = forwardRef<HTMLSpanElement, PresenceDotProps>(
  function PresenceDot({ state, label, className, ...rest }, ref) {
    const owned =
      label === undefined
        ? {
            "aria-hidden": true as const,
            role: undefined,
            "aria-label": undefined,
          }
        : { role: "img", "aria-label": label, "aria-hidden": undefined };
    return (
      <span
        {...rest}
        ref={ref}
        className={cx("pd", state !== "active" && state, className)}
        {...owned}
      />
    );
  },
);
