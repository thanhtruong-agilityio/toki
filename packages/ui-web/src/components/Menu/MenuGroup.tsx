import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";

export type MenuGroupProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "role" | "aria-labelledby"
> & { label: string };

export const MenuGroup = forwardRef<HTMLDivElement, MenuGroupProps>(
  function MenuGroup({ label, children, ...rest }, ref) {
    const id = useId();
    return (
      <div {...rest} ref={ref} role="group" aria-labelledby={id}>
        <div className="mt" id={id}>
          {label}
        </div>
        {children}
      </div>
    );
  },
);

export type MenuSeparatorProps = ComponentPropsWithoutRef<"hr">;

export const MenuSeparator = forwardRef<HTMLHRElement, MenuSeparatorProps>(
  function MenuSeparator(props, ref) {
    return <hr {...props} ref={ref} />;
  },
);
