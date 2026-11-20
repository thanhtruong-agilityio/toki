import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ListFilter, ListRow } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import {
  ConversationList,
  conversationGroupIds,
  type ConversationGroup,
  type ConversationGroupId,
  type ConversationRowData,
} from "@toki/ui-web";
import { useEffect, useMemo, useRef, useState } from "react";
import { personHue } from "../people/person-hue";
import {
  readCollapsed,
  readFilter,
  writeCollapsed,
  writeFilter,
} from "./device-memory";
import { useListActions, type ListAction } from "./list-actions";
import { useConversationSelector } from "./use-conversations";

// A count that counts: finite and above 0 (the rule of R7).
const counts = (value: number): boolean => Number.isFinite(value) && value > 0;

// The total shown on a collapsed heading (R15, concern 18): muted rows and rows with a bad count add 0.
export function collapsedTotal(
  rows: ReadonlyArray<{ isMuted: boolean; unreadCount: number }>,
): number {
  let total = 0;
  for (const row of rows) {
    if (!row.isMuted && counts(row.unreadCount)) total += row.unreadCount;
  }
  return total;
}

const currentIdOf = (pathname: string): string | null => {
  const match = /^\/c\/([^/]+)/.exec(pathname);
  if (match === null) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1]!;
  }
};

type Choice = {
  userId: string | null;
  filter?: ListFilter;
  collapsed?: ConversationGroupId[];
};

// The one place that turns the store into the props of the list (R15). It groups, sorts and names
// nothing: the store does.
export function ConversationListPane() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const opening = useRouterState({
    select: (s) => s.location.state.opening === true,
  });
  const { browseChannels, startDirect } = useListActions();
  const currentId = currentIdOf(pathname);

  const userId = useConversationSelector((s) => s.getUser()?.id ?? null);
  const status = useConversationSelector((s) => s.getState().status);
  const people = useConversationSelector((s) => s.getState().people);

  // R18: the remembered values are read for the signed-in person; a choice made here wins.
  const stored = useMemo(() => {
    if (userId === null) return { filter: "all" as ListFilter, collapsed: [] };
    const storage = getPlatform().storage.device;
    return {
      filter: readFilter(storage, userId),
      collapsed: readCollapsed(storage, userId),
    };
  }, [userId]);
  const [choice, setChoice] = useState<Choice>({ userId: null });
  const mine = choice.userId === userId ? choice : null;
  const filter = mine?.filter ?? stored.filter;
  const collapsed = mine?.collapsed ?? stored.collapsed;
  const [query, setQuery] = useState("");

  const list = useConversationSelector((s) => s.getList({ filter, query }));

  function choose(next: {
    filter?: ListFilter;
    collapsed?: ConversationGroupId[];
  }) {
    setChoice((prev) => ({
      ...(prev.userId === userId ? prev : {}),
      userId,
      ...next,
    }));
    if (userId === null) return;
    const storage = getPlatform().storage.device;
    if (next.filter !== undefined) writeFilter(storage, userId, next.filter);
    if (next.collapsed !== undefined) {
      writeCollapsed(storage, userId, next.collapsed);
    }
  }

  // R34: a conversation that opens is shown. The group that holds it is the one in the unfiltered list.
  const held = useConversationSelector(
    (s) => currentId !== null && s.hasConversation(currentId),
  );
  const holder = useConversationSelector((s) => {
    if (currentId === null) return null;
    const all = s.getList({ filter: "all", query: "" });
    return (
      conversationGroupIds.find((id) =>
        all[id].some((row) => row.id === currentId),
      ) ?? null
    );
  });
  const handled = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (status !== "ready") return;
    // The id that is current when the store first becomes ready is the opening address (reload).
    if (handled.current === undefined) {
      handled.current = currentId;
      return;
    }
    if (currentId === handled.current) return;
    if (currentId === null) {
      handled.current = null;
      return;
    }
    if (!held || holder === null) return;
    handled.current = currentId;
    if (opening) return;
    const drawn =
      !collapsed.includes(holder) &&
      list[holder].some((row) => row.id === currentId);
    if (drawn) return;
    setQuery("");
    choose({
      filter: "all",
      collapsed: collapsed.filter((id) => id !== holder),
    });
    // `choose`, `collapsed` and `list` are read at the moment the conversation changes only.
  }, [status, currentId, held, holder, opening]);

  const groups = useMemo<ConversationGroup[]>(() => {
    const labels: Record<ConversationGroupId, string> = {
      starred: t("conversationList.group.starred"),
      channels: t("conversationList.group.channels"),
      direct: t("conversationList.group.direct"),
    };
    const toRow = (row: ListRow): ConversationRowData => {
      const person =
        row.otherPersonId === null ? undefined : people[row.otherPersonId];
      return {
        id: row.id,
        href: `/c/${encodeURIComponent(row.id)}`,
        kind: row.kind,
        name: row.name,
        isPrivate: row.kind === "channel" && row.isPrivate,
        isStarred: row.isStarred,
        avatar:
          row.kind === "dm"
            ? {
                name: person?.displayName ?? row.name,
                hue: personHue(row.otherPersonId ?? row.id),
              }
            : undefined,
        unreadCount: row.unreadCount,
        unreadLabel: counts(row.unreadCount)
          ? t("conversationList.row.unread", { count: row.unreadCount })
          : undefined,
        hasMention: row.hasMention,
        mentionLabel: t("conversationList.row.mention"),
        isMuted: row.isMuted,
        mutedLabel: t("conversationList.row.muted"),
        privateLabel: t("conversationList.row.private"),
        starredLabel: t("conversationList.row.starred"),
        deactivatedLabel:
          person?.status === "deactivated"
            ? t("conversationList.row.deactivated")
            : undefined,
        current: row.id === currentId,
      };
    };
    const press =
      (open: ListAction) => (event: { currentTarget: HTMLElement }) =>
        open({ returnFocusRef: { current: event.currentTarget } });
    return conversationGroupIds.map((id) => {
      const isCollapsed = collapsed.includes(id);
      const group: ConversationGroup = {
        id,
        label: labels[id],
        collapsed: isCollapsed,
        rows: list[id].map(toRow),
        // R16: a person with no direct message still sees the heading and its '+'.
        keepWhenEmpty: id === "direct" && filter === "all" && query === "",
      };
      if (id === "direct" && startDirect) {
        group.action = {
          label: t("conversationList.direct.add"),
          onPress: press(startDirect),
        };
      }
      if (isCollapsed) {
        const total = collapsedTotal(list[id]);
        group.unreadCount = total;
        group.unreadLabel = t("conversationList.group.unread", {
          count: total,
        });
      }
      return group;
    });
  }, [list, people, collapsed, filter, query, currentId, startDirect, t]);

  const filterOptions = useMemo(
    () =>
      (["all", "unread", "mentions"] as const).map((id) => ({
        id,
        label: t(`conversationList.filter.${id}`),
      })),
    [t],
  );

  return (
    <ConversationList
      title={t("nav.conversations")}
      aria-busy={status === "ready" ? undefined : true}
      browse={
        browseChannels
          ? {
              label: t("conversationList.browse"),
              onPress: (event) =>
                browseChannels({
                  returnFocusRef: { current: event.currentTarget },
                }),
            }
          : undefined
      }
      search={{
        value: query,
        label: t("conversationList.search.label"),
        placeholder: t("conversationList.search.placeholder"),
        onChange: setQuery,
      }}
      filters={{
        label: t("conversationList.filter.label"),
        value: filter,
        options: filterOptions,
        onChange: (id) => choose({ filter: id as ListFilter }),
      }}
      groups={groups}
      onToggleGroup={(id) =>
        choose({
          collapsed: collapsed.includes(id)
            ? collapsed.filter((other) => other !== id)
            : [...collapsed, id],
        })
      }
      onOpenRow={(row) => {
        void navigate({
          to: "/c/$conversationId",
          params: { conversationId: row.id },
          // R20: `fromList` only when the press is made at `/`, so the entry before is the list.
          state: pathname === "/" ? { fromList: true } : undefined,
        });
      }}
      empty={{
        title: t("conversationList.empty.title"),
        description: t("conversationList.empty.description"),
        actionLabel: t("conversationList.empty.clear"),
        onAction: () => {
          setQuery("");
          choose({ filter: "all" });
        },
      }}
    />
  );
}
