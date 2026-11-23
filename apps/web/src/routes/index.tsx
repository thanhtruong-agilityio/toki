import { createRoute, useRouter } from "@tanstack/react-router";
import { getPlatform } from "@toki/platform";
import { useNarrow } from "@toki/ui-web";
import { useEffect } from "react";
import { conversations } from "../client";
import { viewFallback } from "../conversation-list/last-viewed";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { appLayoutRoute } from "./app-layout";

// `/` (R23). A window of 720 px or more replaces it with the conversation to open once the store is
// ready, and shows nothing until then; a narrow window does not redirect, because Home is the list
// there (the shell draws it). A window that goes from narrow to wide while here redirects then.
export function IndexRedirect() {
  const router = useRouter();
  const narrow = useNarrow();
  const status = useConversationSelector((s) => s.getState().status);
  const userId = useConversationSelector((s) => s.getUser()?.id ?? null);
  const generalId = useConversationSelector((s) => s.getGeneralId());

  useEffect(() => {
    if (narrow || status !== "ready" || userId === null) return;
    const to = viewFallback(
      getPlatform().storage.device,
      userId,
      conversations,
    );
    if (to === null) return;
    void router.navigate({
      to: "/c/$conversationId",
      params: { conversationId: to },
      replace: true,
      state: { opening: true },
    });
  }, [router, narrow, status, userId, generalId]);

  return null;
}

export const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: IndexRedirect,
});
