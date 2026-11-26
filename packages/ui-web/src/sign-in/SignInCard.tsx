import type { ReactNode } from "react";
import { useTranslation } from "@toki/i18n/react";
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

// One centred card on the page background, with the logo, the workspace name and the line
// under it (`on Toki`, drawn only with a name) on top and a step below (R4, R7, R8).
export function SignInCard({ workspaceName, children }: SignInCardProps) {
  const { t } = useTranslation();
  const name = workspaceName?.trim() ? workspaceName : undefined;
  return (
    <div className="gsign">
      <div className="gcard">
        <div className="gws">
          <span className="gwl" aria-hidden="true">
            {name !== undefined ? firstLetter(name) : <Icon name="bolt" />}
          </span>
          {name !== undefined ? (
            <div className="gwt">
              <span className="gwn">{name}</span>
              <span className="gwp xs muted">{t("signIn.card.platform")}</span>
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
