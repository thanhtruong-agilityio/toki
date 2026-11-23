import { useEffect, useRef } from "react";
import { useTranslation } from "@toki/i18n/react";
import { SignInCard } from "../sign-in/SignInCard";
import "./join.css";

export type InvitationRefusalProps = {
  /** Why the link cannot be used (R35). */
  reason: "expired" | "revoked" | "unknown";
  /** From the lookup. Shown for `expired` and `revoked` only: the page for an unrecognised link shows
   * no name of the workspace anywhere (R35, D-081), whatever is passed. */
  workspaceName?: string;
};

// The three pages for a link that cannot be used: the card, one heading and, for the first two, one
// line. No field and no button: nobody is signed in from here (R35). The focus starts on the heading,
// which is not a tab stop (R41).
export function InvitationRefusal({
  reason,
  workspaceName,
}: InvitationRefusalProps) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <SignInCard
      workspaceName={reason === "unknown" ? undefined : workspaceName}
    >
      <h1 ref={heading} tabIndex={-1} className="gjoin-heading">
        {reason === "expired"
          ? t("join.expired.title")
          : reason === "revoked"
            ? t("join.revoked.title")
            : t("join.notFound.title")}
      </h1>
      {reason === "expired" ? <p>{t("join.expired.body")}</p> : null}
      {reason === "revoked" ? <p>{t("join.revoked.body")}</p> : null}
    </SignInCard>
  );
}
