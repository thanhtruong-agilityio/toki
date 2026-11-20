import { useEffect, useRef } from "react";
import { useTranslation } from "@toki/i18n/react";
import { Button } from "../components/Button/Button";
import { SignInCard } from "../sign-in/SignInCard";
import "./join.css";

export type SignedInQuestionProps = {
  /** The address of the person who is signed in. Shown as an address (R36). */
  current: string;
  /** The address of the invitation. Shown as an address (R36). */
  invited: string;
  workspaceName?: string;
  onSignOut: () => void;
  onStay: () => void;
};

// The question for a person who is signed in as someone else (D-080, R36): the card, the heading with
// the question and two buttons one above the other, the first primary. Nothing is sent and nothing
// changes while it shows; the page does what each button says. The focus starts on the heading, which
// is not a tab stop, and the tab order is the order of the buttons (R41).
export function SignedInQuestion({
  current,
  invited,
  workspaceName,
  onSignOut,
  onStay,
}: SignedInQuestionProps) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <SignInCard workspaceName={workspaceName}>
      <h1 ref={heading} tabIndex={-1} className="gjoin-heading">
        {t("join.signedIn.question", { current, invited })}
      </h1>
      <div className="gjoin-actions">
        <Button variant="primary" fullWidth onClick={onSignOut}>
          {t("join.signedIn.signOut")}
        </Button>
        <Button fullWidth onClick={onStay}>
          {t("join.signedIn.stay")}
        </Button>
      </div>
    </SignInCard>
  );
}
