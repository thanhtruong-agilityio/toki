import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useCallback } from "react";
import { useOnlineGate } from "../../patterns";
import { conversations } from "../deps";
import { joinChannel, type JoinResult } from "./joinChannel";

export type JoinRequest = {
  id: string;
  name: string;
  isMounted: () => boolean;
  onJoined: () => void;
};

// Reads the hooks in the component that calls it and returns the bound plain function (R11), which a
// row and `UnjoinedChannel` use.
export function useJoinChannel(): (
  request: JoinRequest,
) => Promise<JoinResult> {
  const { ensureOnline } = useOnlineGate();
  const { show } = useToasts();
  const { t } = useTranslation();
  return useCallback(
    (request) =>
      joinChannel({
        ...request,
        ensureOnline: () => ensureOnline(),
        join: (id) => conversations.joinChannel(id),
        show,
        t,
      }),
    [ensureOnline, show, t],
  );
}
