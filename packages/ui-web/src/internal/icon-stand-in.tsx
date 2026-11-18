// Stand-in for the icons of TOKI-011 until that ticket is on main. IconButton
// and Field import only from this file; when TOKI-011 merges, the import is
// swapped for the real `Icon` and `IconName`, and this file is deleted. It is
// not exported from src/index.ts.
import type { SVGProps } from "react";

export type IconName = "x" | "plus" | "search" | "check";

export function Icon({
  name,
  ...rest
}: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      className="ic"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      {...rest}
    />
  );
}
