// The one seam of this folder (R3): the only file that imports `@toki/client-core`,
// the client, the ids or a file of another feature. The tests of the screen
// replace it with `vi.mock`. TOKI-033 and TOKI-034 are not on `main` yet, so the
// pieces they own are stand-ins here, each marked with the ticket and the real
// export that replaces it; the replacing change is this file only.
import { useRouter } from "@tanstack/react-router";
import type { ConversationStore } from "@toki/client-core";
import { useSyncExternalStore } from "react";
import { conversations } from "../../client";

export { ApiError, classifyApiError } from "@toki/client-core";
export { conversations };
export { newId } from "../../ids";
// TODO(TOKI-034): re-export `PeoplePicker` from `features/people/PeoplePicker.tsx`.
export { PeoplePicker } from "./PeoplePickerStandIn";

// TODO(TOKI-033): re-export `useConversationSelector` (TOKI-033 R29). The
// selector must return a value that is the same while nothing it reads changes.
export function useConversationSelector<T>(
  selector: (store: ConversationStore) => T,
): T {
  return useSyncExternalStore(conversations.subscribe, () =>
    selector(conversations),
  );
}

// TODO(TOKI-034): re-export `usePeople` and `useCurrentUserId` (TOKI-034 R2).
export const usePeople = () =>
  useConversationSelector((store) => store.getPeople());
export const useCurrentUserId = () =>
  useConversationSelector((store) => store.getUser()?.id ?? null);

export const useCurrentRole = () =>
  useConversationSelector((store) => store.getUser()?.role ?? null);

// `personHue` (TOKI-033 R28) is on `main` since TOKI-099.
export { personHue } from "../../people/person-hue";

// TODO(TOKI-033): the route `/c/$conversationId` (TOKI-033 R20) does not exist,
// so the call is untyped; replace with the typed navigation.
export function useOpenConversation(): (id: string) => void {
  const router = useRouter();
  return (id) => {
    void (router.navigate as (options: { to: string }) => Promise<void>)({
      to: `/c/${id}`,
    });
  };
}
