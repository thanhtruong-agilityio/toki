import type { SVGProps } from "react";
import { iconPaths, type IconName } from "./paths";

// What the icon sets itself: a caller cannot pass these (R5, R7, R15).
type OwnedProps =
  | "ref"
  | "stroke"
  | "fill"
  | "viewBox"
  | "width"
  | "height"
  | "strokeWidth"
  | "strokeLinecap"
  | "strokeLinejoin"
  | "role"
  | "dangerouslySetInnerHTML"
  | "aria-label"
  | "aria-labelledby"
  | "aria-hidden"
  | "title"
  | "children";

export type IconProps = Omit<SVGProps<SVGSVGElement>, OwnedProps> & {
  /** Width and height in pixels. Default 18. */
  size?: number;
  /** Stroke width. Default 1.75. */
  strokeWidth?: number;
  // Hyphenated names are not checked by TypeScript unless declared, so refuse these three here.
  "aria-label"?: never;
  "aria-labelledby"?: never;
  "aria-hidden"?: never;
};

/** The svg of the prototype's `icon()` function. */
export function IconBase({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
  ...rest
}: IconProps & { name: IconName }) {
  // The icon owns these; drop them at run time as well (R5, R15).
  const passed: Record<string, unknown> = rest;
  delete passed.role;
  delete passed.dangerouslySetInnerHTML;
  return (
    <svg
      {...rest}
      className={className ? `ic ${className}` : "ic"}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function createIcon(name: IconName) {
  const component = (props: IconProps) => <IconBase {...props} name={name} />;
  component.displayName = `${name}Icon`;
  return component;
}
