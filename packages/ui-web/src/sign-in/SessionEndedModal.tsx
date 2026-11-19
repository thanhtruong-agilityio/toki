import { useId, useRef } from "react";
import { useTranslation } from "@toki/i18n/react";
import { Button } from "../components/Button/Button";
import { Modal } from "../components/Modal/Modal";
import "./sign-in.css";

export type SessionEndedModalProps = {
  /** `ended`: 'Sign in again'. `deactivated`: no button (R24, R26). */
  form: "ended" | "deactivated";
  onSignInAgain: () => void;
  /**
   * The link of the deactivated form when Toki is opened (R26). Shown only in
   * that form and only when given.
   */
  onUseDifferentEmail?: () => void;
};

// The cover of R24 and R26, built from the Modal by its props alone: opaque,
// no close control, nothing happens on Esc or a press outside, and the focus is
// not given back. The page mounts it while the state is `ended`.
export function SessionEndedModal(props: SessionEndedModalProps) {
  const { form, onSignInAgain, onUseDifferentEmail } = props;
  const { t } = useTranslation();
  const textId = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ended = form === "ended";
  return (
    <Modal
      open
      backdrop="opaque"
      returnFocus={false}
      onRequestClose={() => {}}
      aria-labelledby={textId}
      initialFocusRef={ended ? buttonRef : textRef}
    >
      <div className="gmodal">
        <p id={textId} ref={textRef} tabIndex={-1} className="gmodal-text">
          {ended ? t("sessionEnded.title") : t("sessionEnded.deactivated")}
        </p>
        {ended ? (
          <Button ref={buttonRef} variant="primary" onClick={onSignInAgain}>
            {t("sessionEnded.signInAgain")}
          </Button>
        ) : onUseDifferentEmail ? (
          <Button variant="link" onClick={onUseDifferentEmail}>
            {t("signIn.code.changeEmail")}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
