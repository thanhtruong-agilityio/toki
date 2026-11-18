import { useId } from "react";

// What Field and Select share: the id of the control, the validity that an
// `error` text gives, the aria-describedby list and the error box (R17).
export function useFieldFrame(
  idProp: string | undefined,
  error: string | undefined,
  describedBy: string | undefined,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const message =
    typeof error === "string" && error.trim() !== "" ? error : undefined;
  const errorId = `${id}-error`;
  const invalid = message !== undefined;
  const ariaDescribedBy =
    [describedBy, invalid ? errorId : undefined].filter(Boolean).join(" ") ||
    undefined;
  return {
    id,
    invalid,
    ariaInvalid: invalid ? (true as const) : undefined,
    ariaDescribedBy,
    errorBox: invalid ? (
      <div className="gerr" role="alert" id={errorId}>
        {message}
      </div>
    ) : null,
  };
}
