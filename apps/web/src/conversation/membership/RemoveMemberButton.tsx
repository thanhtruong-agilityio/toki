import { useTranslation } from "@toki/i18n/react";
import type { BootstrapPerson } from "@toki/shared";
import { Button } from "@toki/ui-web";

// "Remove" at the end of a member row (R5): the last child of `.mrow` and a sibling of the row's own
// content, never inside it, with the person's name in its accessible name.
export function RemoveMemberButton({
  person,
  onAsk,
}: {
  person: BootstrapPerson;
  onAsk: (person: BootstrapPerson, button: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      className="mbr-remove"
      aria-label={t("membership.remove.label", { name: person.displayName })}
      onClick={(event) => onAsk(person, event.currentTarget)}
    >
      {t("membership.remove.button")}
    </Button>
  );
}
