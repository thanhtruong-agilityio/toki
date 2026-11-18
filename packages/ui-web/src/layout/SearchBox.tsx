import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { SearchIcon } from "../icons";
import { cx } from "../internal/cx";
import "./shell.css";

export type SearchBoxProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "type" | "aria-label" | "onClick"
> & {
  search?: { label: string; hint?: string; onOpen: () => void };
};

export const SearchBox = forwardRef<HTMLButtonElement, SearchBoxProps>(
  function SearchBox({ search, className, ...rest }, ref) {
    if (!search) return null;
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        className={cx("srch", className)}
        aria-label={search.label}
        onClick={() => search.onOpen()}
      >
        <SearchIcon />
        <span className="t">{search.label}</span>
        {search.hint !== undefined && (
          <span className="kbd">{search.hint}</span>
        )}
      </button>
    );
  },
);
