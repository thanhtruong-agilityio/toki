import type { ReactNode } from "react";
import { Icon } from "../icons";
import "./sign-in.css";

// The workspace's first letter, upper-cased.
function firstLetter(name: string): string {
  const first = Array.from(name)[0];
  return first === undefined ? "" : first.toUpperCase();
}

export type SignInCardProps = {
  /** The name from the server; none while it loads and when it fails (R38). */
  workspaceName?: string;
  children?: ReactNode;
};

// One centred card on the page background, with the logo and the workspace
// name on top and a step below (R4, R8).
export function SignInCard({ workspaceName, children }: SignInCardProps) {
  const name = workspaceName?.trim() ? workspaceName : undefined;
  return (
    <div className="gsign">
      <div className="gcard">
        <div className="gws">
          <span className="gwl" aria-hidden="true">
            {name !== undefined ? firstLetter(name) : <Icon name="bolt" />}
          </span>
          {name !== undefined ? <span className="gwn">{name}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
