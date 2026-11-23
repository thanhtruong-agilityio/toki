import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import { Avatar } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import "./PersonChip.css";

export type PersonChipProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> & {
  name: string;
  // The colour of the person, 0 to 359 (the Avatar's `hue`).
  hue: number;
  // The accessible name of the remove button, already translated by the caller.
  removeLabel: string;
  onRemove: () => void;
};

// A chosen person in a field: avatar, name, and a button that removes it. The
// component holds no text of its own (TOKI-034 R3, R17).
export const PersonChip = forwardRef<HTMLSpanElement, PersonChipProps>(
  function PersonChip(
    { name, hue, removeLabel, onRemove, className, ...rest },
    ref,
  ) {
    return (
      <span {...rest} ref={ref} className={cx("pchip", className)}>
        <Avatar name={name} hue={hue} size={20} />
        <span className="nm">{name}</span>
        <IconButton size="sm" icon="x" label={removeLabel} onClick={onRemove} />
      </span>
    );
  },
);
