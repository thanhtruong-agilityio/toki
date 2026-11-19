import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../internal/cx";
import "./shell.css";

export type WorkspaceHeaderProps = ComponentPropsWithoutRef<"div"> & {
  workspace?: { name: string; detail?: string };
};

// The workspace's first letter, upper-cased (R8).
function firstLetter(name: string): string {
  const first = Array.from(name)[0];
  return first === undefined ? "" : first.toUpperCase();
}

export const WorkspaceHeader = forwardRef<HTMLDivElement, WorkspaceHeaderProps>(
  function WorkspaceHeader({ workspace, className, ...rest }, ref) {
    if (!workspace) return null;
    return (
      <div {...rest} ref={ref} className={cx("ws", className)}>
        <span className="wsl">{firstLetter(workspace.name)}</span>
        <div className="wst">
          <div className="wsn">{workspace.name}</div>
          {workspace.detail !== undefined && (
            <div className="wss">{workspace.detail}</div>
          )}
        </div>
      </div>
    );
  },
);
