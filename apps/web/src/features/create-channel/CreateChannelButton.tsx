import { useTranslation } from "@toki/i18n/react";
import { IconButton } from "@toki/ui-web";
import { useRef } from "react";
import { useCurrentRole } from "./deps";
import { useCreateChannelDialog } from "./useCreateChannelDialog";

// The "+" of the Admin page's Channels heading and the dialog it opens (R4).
// It renders nothing for a role that is not `admin`.
export function CreateChannelButton({
  onCreated,
}: {
  onCreated?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const role = useCurrentRole();
  const { open, element } = useCreateChannelDialog({ onCreated });
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (role !== "admin") return null;
  return (
    <>
      <IconButton
        ref={buttonRef}
        icon="plus"
        size="sm"
        label={t("createChannel.open")}
        onClick={() => open({ returnFocusRef: buttonRef })}
      />
      {element}
    </>
  );
}
