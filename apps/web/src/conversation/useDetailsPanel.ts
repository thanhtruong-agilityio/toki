import { useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";

// The search parameter of `/c/$conversationId` (R8): `panel=details` or nothing; every other value
// is dropped.
export const validatePanelSearch = (
  search: Record<string, unknown>,
): { panel?: "details" } =>
  search.panel === "details" ? { panel: "details" as const } : {};

// The Details panel is open when the address carries `panel=details`. Opening pushes one entry and
// marks it, so Back pops it; closing goes back when the entry was pushed by this app and replaces
// the address when it was not (a link or a reload that lost the state), so Back never leaves the
// conversation while the panel is open (R8, R9, D-089).
export function useDetailsPanel(conversationId: string) {
  const router = useRouter();
  const open = useRouterState({
    select: (s) =>
      (s.location.search as { panel?: unknown }).panel === "details",
  });

  const openDetails = useCallback(() => {
    void router.navigate({
      to: "/c/$conversationId",
      params: { conversationId },
      search: { panel: "details" },
      state: { detailsPushed: true },
    });
  }, [router, conversationId]);

  const closeDetails = useCallback(() => {
    if (router.state.location.state.detailsPushed === true) {
      router.history.back();
    } else {
      void router.navigate({
        to: "/c/$conversationId",
        params: { conversationId },
        search: {},
        replace: true,
      });
    }
  }, [router, conversationId]);

  return { open, openDetails, closeDetails };
}
