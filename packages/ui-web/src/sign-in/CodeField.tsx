import { forwardRef, type ChangeEvent, type ClipboardEvent } from "react";
import { useTranslation } from "@toki/i18n/react";
import { cx } from "../internal/cx";
import { Field } from "../components/Field/Field";
import "./sign-in.css";

export type CodeFieldProps = {
  /** The length of the code: the shared constant, passed in by the page. */
  codeLength: number;
  value: string;
  onChange: (digits: string) => void;
  /** Called once when an edit brings the field to `codeLength` digits. */
  onComplete?: (digits: string) => void;
  /** Called on Enter in the field (R36). */
  onEnter?: () => void;
  /** The one message under the field; the field is then marked invalid. */
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
  shake?: boolean;
};

// Digits only, `codeLength` at most (R9); the send action starts on the last
// digit (R10).
export const CodeField = forwardRef<HTMLInputElement, CodeFieldProps>(
  function CodeField(
    {
      codeLength,
      value,
      onChange,
      onComplete,
      onEnter,
      error,
      readOnly,
      disabled,
      shake,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const take = (digits: string) => {
      const wasComplete = value.length >= codeLength;
      onChange(digits);
      if (digits.length === codeLength && !wasComplete) onComplete?.(digits);
    };
    const handle = (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => take(event.target.value.replace(/\D/g, "").slice(0, codeLength));
    // The browser cuts a paste at maxLength before the digits are picked out
    // ('123 456' would arrive as '123 45'), so the paste is read here.
    const paste = (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
      event.preventDefault();
      const { selectionStart, selectionEnd } = event.currentTarget;
      const from = selectionStart ?? value.length;
      const to = selectionEnd ?? value.length;
      take(
        (value.slice(0, from) + pasted + value.slice(to)).slice(0, codeLength),
      );
    };
    return (
      <Field
        ref={ref}
        label={t("signIn.code.label")}
        variant="code"
        placeholder={"0".repeat(codeLength)}
        className={cx(shake && "shake")}
        value={value}
        onChange={handle}
        onPaste={paste}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
        error={error}
        readOnly={readOnly}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={codeLength}
      />
    );
  },
);
