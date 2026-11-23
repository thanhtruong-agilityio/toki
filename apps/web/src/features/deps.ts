// The one seam of this change (TOKI-034 R2): the only file that imports `@toki/client-core` or the
// client. The names are those of Table N, taken from TOKI-032 (the client and the store) and TOKI-033
// (the registry, the selector and `personHue`). A rename there changes this file only, and the tests
// of the screens replace it with `vi.mock`.
import { useConversationSelector } from "../conversation-list/use-conversations";

export { api, conversations } from "../client";
export { ApiError } from "@toki/client-core";
export { useConversationSelector };
export { personHue } from "../people/person-hue";
export {
  useRegisterListActions,
  type ListAction,
} from "../conversation-list/list-actions";

// `getPeople()` returns the same array while the state is unchanged (TOKI-032 R22), so this is the
// snapshot of `useSyncExternalStore` as it is: no array is built here and there is no `useMemo`.
export function usePeople() {
  return useConversationSelector((s) => s.getPeople());
}

export function useCurrentUserId(): string | undefined {
  return useConversationSelector((s) => s.getUser()?.id);
}
