import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import { cx } from "../../internal/cx";
import { PresenceDot, type PresenceState } from "../PresenceDot/PresenceDot";
import { getInitials } from "./getInitials";
import "./Avatar.css";

export type AvatarProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "aria-label" | "aria-labelledby" | "aria-hidden" | "title" | "children"
> & {
  name: string;
  // The colour of the person, 0 to 359 (R8). The accounts and People tickets
  // decide where the number comes from; the component only draws it.
  hue: number;
  // Pixels. Without it the size is the density value --av (R6).
  size?: number;
  presence?: PresenceState;
  presenceLabel?: string;
};

// Any hue is taken modulo 360; a value that is not a finite number gives 0.
function normaliseHue(hue: number): number {
  return Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : 0;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, hue, size, presence, presenceLabel, className, style, ...rest },
  ref,
) {
  const own: Record<string, string> = { "--h": String(normaliseHue(hue)) };
  if (typeof size === "number" && Number.isFinite(size) && size > 0) {
    own["--s"] = `${size}px`;
  }
  // The attributes below are removed even when a caller casts them in (R6).
  const {
    "aria-label": _label,
    "aria-labelledby": _labelledby,
    title: _title,
    "aria-hidden": _hidden,
    ...others
  } = rest as typeof rest & Record<string, unknown>;
  void [_label, _labelledby, _title, _hidden];

  if (presence === undefined) {
    return (
      <span
        {...others}
        ref={ref}
        className={cx("av", className)}
        style={{ ...style, ...own } as CSSProperties}
        aria-hidden="true"
      >
        {getInitials(name)}
      </span>
    );
  }
  return (
    <span {...others} ref={ref} className={cx("pdw", className)} style={style}>
      <span className="av" style={own as CSSProperties} aria-hidden="true">
        {getInitials(name)}
      </span>
      <PresenceDot state={presence} label={presenceLabel} />
    </span>
  );
});
