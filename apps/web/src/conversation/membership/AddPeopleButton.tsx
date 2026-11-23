import { useTranslation } from "@toki/i18n/react";
import { Button } from "@toki/ui-web";
import type { Ref } from "react";

// "Add people" (R5): a small text button, always visible, disabled until the first read of the
// members list has answered (R6).
export function AddPeopleButton({
  disabled,
  onOpen,
  buttonRef,
}: {
  disabled: boolean;
  onOpen: (button: HTMLElement) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  return (
    <Button
      ref={buttonRef}
      size="sm"
      disabled={disabled}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      {t("membership.add.button")}
    </Button>
  );
}
