import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import "./Tag.css";

export type TagProps = ComponentPropsWithoutRef<"span">;

// The capitals come from CSS, not from the text (R19).
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { className, ...rest },
  ref,
) {
  return <span {...rest} ref={ref} className={cx("tag", className)} />;
});
