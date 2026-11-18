import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cx } from "../internal/cx";
import "./shell.css";

export type SectionPageProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "title"
> & {
  // Already translated; the frame sets no text of its own (R12).
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

// The frame of a section screen: the header row and the scrolling body (R12).
// `ref`, `className` and the other attributes go to `div.sechead`.
export const SectionPage = forwardRef<HTMLDivElement, SectionPageProps>(
  function SectionPage({ title, actions, children, className, ...rest }, ref) {
    return (
      <>
        <div {...rest} ref={ref} className={cx("sechead", className)}>
          <h1 className="title">{title}</h1>
          {actions}
        </div>
        <div className="secbody">{children}</div>
      </>
    );
  },
);
