import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useCallback } from "react";
import { isOnline } from "./online";

export type OnlineGateKind = "action" | "undo";

// Returns `ensureOnline`: true when the connection is up, otherwise one plain
// toast that says why and false (D-079: blocked with an explanation, never a
// false success).
export function useOnlineGate(): {
  ensureOnline: (kind?: OnlineGateKind) => boolean;
} {
  const { show } = useToasts();
  const { t } = useTranslation();
  const ensureOnline = useCallback(
    (kind: OnlineGateKind = "action") => {
      if (isOnline()) return true;
      show({
        text:
          kind === "undo"
            ? t("common.offline.undoBlocked")
            : t("common.offline.blocked"),
      });
      return false;
    },
    [show, t],
  );
  return { ensureOnline };
}
