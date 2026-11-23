import { createRoute, useParams, useRouter } from "@tanstack/react-router";
import { getPlatform } from "@toki/platform";
import { useEffect, useReducer, useState } from "react";
import { conversations } from "../client";
import {
  ArchivedChannelPage,
  ArchivedHistory,
  isArchivedMember,
} from "../channel-archive";
import { useConversationSelector } from "../conversation-list/use-conversations";
import {
  viewFallback,
  writeLastViewed,
} from "../conversation-list/last-viewed";
import { ConversationPage } from "../conversation/ConversationPage";
import { validatePanelSearch } from "../conversation/useDetailsPanel";
import { UnjoinedView } from "../conversation/UnjoinedView";
import { useSessionSets } from "../shell/session-sets";
import { appLayoutRoute } from "./app-layout";
import { NotFoundView } from "./NotFoundView";

// What the route draws for one id (R21). The store's `status` decides first: nothing is drawn, and
// nothing redirects, until the first load is `ready`.
function ConversationRouteBody({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const status = useConversationSelector((s) => s.getState().status);
  const held = useConversationSelector((s) =>
    s.hasConversation(conversationId),
  );
  const userId = useConversationSelector((s) => s.getUser()?.id ?? null);
  // An archived channel the person belongs to has no entry but the store holds its detail (R13).
  const archivedMember = useConversationSelector((s) =>
    isArchivedMember(s.getChannelDetail(conversationId)),
  );
  const { seen, memberChecked } = useSessionSets();
  const [notFound, setNotFound] = useState(false);
  // `memberChecked` is a set, not state: a render after the refresh reads it.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const ready = status === "ready";
  const wasSeen = !held && seen.has(conversationId);

  // (a) the id is written as the last viewed.
  useEffect(() => {
    if (ready && held && userId !== null) {
      writeLastViewed(getPlatform().storage.device, userId, conversationId);
    }
  }, [ready, held, userId, conversationId]);

  // (c) the id was in the list and no longer is: the view moves to the fallback, with no error,
  // unless the store holds the detail of an archived channel the person belongs to (R13).
  useEffect(() => {
    if (!ready || held || !wasSeen || userId === null || archivedMember) return;
    const to = viewFallback(
      getPlatform().storage.device,
      userId,
      conversations,
    );
    if (to === null || to === conversationId) return;
    void router.navigate({
      to: "/c/$conversationId",
      params: { conversationId: to },
      replace: true,
    });
  }, [ready, held, wasSeen, archivedMember, userId, conversationId, router]);

  const onBack = () => {
    // `fromList` means the entry before is `/`, so Back ends on the list (R20, R21).
    if (router.state.location.state.fromList === true) {
      router.history.back();
    } else {
      void router.navigate({ to: "/", replace: true });
    }
  };
  if (!ready) return null;
  if (held) {
    return <ConversationPage conversationId={conversationId} onBack={onBack} />;
  }
  // R13: before (b) and (c), so an archived channel that the person belongs to is neither the
  // not-found view nor the fallback.
  if (archivedMember) {
    return (
      <ArchivedChannelPage channelId={conversationId} onBack={onBack}>
        <ArchivedHistory channelId={conversationId} />
      </ArchivedChannelPage>
    );
  }
  if (wasSeen) return null;
  if (notFound || memberChecked.has(conversationId)) return <NotFoundView />;
  return (
    <UnjoinedView
      channelId={conversationId}
      // Nothing to do: the store now holds the conversation, so this route draws (a).
      onJoined={() => {}}
      onMember={() => {
        memberChecked.add(conversationId);
        void conversations.refresh().then(rerender);
      }}
      onNotFound={() => setNotFound(true)}
    />
  );
}

export function ConversationRouteView() {
  const { conversationId } = useParams({ strict: false }) as {
    conversationId: string;
  };
  // One body per id, so the local state of one id is not carried to the next.
  return (
    <ConversationRouteBody
      key={conversationId}
      conversationId={conversationId}
    />
  );
}

// `/c/$conversationId` (R21). The one search parameter is `panel=details` (TOKI-035 R8).
export const conversationRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/c/$conversationId",
  validateSearch: validatePanelSearch,
  component: ConversationRouteView,
});
