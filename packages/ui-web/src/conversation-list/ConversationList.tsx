import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Avatar, type AvatarProps } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Chip, ChipGroup } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { Field } from "../components/Field";
import { IconButton } from "../components/IconButton";
import { Tag } from "../components/Tag";
import {
  DownIcon,
  HashIcon,
  LockIcon,
  PlusIcon,
  StarIcon,
  UsersIcon,
} from "../icons";
import { cx } from "../internal/cx";
import { isPlainClick } from "../layout/NavSection";
import "./conversation-list.css";

export const conversationGroupIds = ["starred", "channels", "direct"] as const;
export type ConversationGroupId = (typeof conversationGroupIds)[number];

// The data of one row (R6). Every text is already translated; the list holds none of its own (R2).
export type ConversationRowData = {
  id: string;
  href: string;
  kind: "channel" | "dm" | "group_dm";
  name: string;
  isPrivate?: boolean;
  isStarred?: boolean;
  avatar?: {
    name: string;
    hue: number;
    presence?: AvatarProps["presence"];
    presenceLabel?: string;
  };
  unreadCount?: number;
  unreadLabel?: string;
  hasMention?: boolean;
  mentionLabel?: string;
  isMuted?: boolean;
  mutedLabel?: string;
  privateLabel?: string;
  starredLabel?: string;
  deactivatedLabel?: string;
  draftLabel?: string;
  current?: boolean;
};

// A control the list draws only for a handler it was given (R5, R8). The handler gets the
// click event, so the caller can keep the pressed control to return focus to it.
export type ConversationListAction = {
  label: string;
  onPress: (event: MouseEvent<HTMLButtonElement>) => void;
};

export type ConversationGroup = {
  id: ConversationGroupId;
  label: string;
  collapsed: boolean;
  rows: ConversationRowData[];
  keepWhenEmpty?: boolean;
  action?: ConversationListAction;
  // The total of a collapsed group (R4); the wiring sums it, the list only draws it.
  unreadCount?: number;
  unreadLabel?: string;
};

export type ConversationListProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "title"
> & {
  title: string;
  browse?: ConversationListAction;
  notice?: ReactNode;
  search: {
    value: string;
    label: string;
    placeholder: string;
    onChange: (value: string) => void;
  };
  filters: {
    label: string;
    value: string;
    options: Array<{ id: string; label: string }>;
    onChange: (id: string) => void;
  };
  groups: ConversationGroup[];
  onToggleGroup?: (id: ConversationGroupId) => void;
  onOpenRow?: (
    row: ConversationRowData,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void;
  // Missing while the store holds no data (idle, loading, failed): `div.clist` then draws no empty state.
  empty?: {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  };
};

// A count draws only when it is a finite number above 0 (R7).
export function isCount(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function Glyph({ row }: { row: ConversationRowData }) {
  if (row.kind === "dm") {
    const avatar = row.avatar ?? { name: row.name, hue: 0 };
    return (
      <Avatar
        name={avatar.name}
        hue={avatar.hue}
        size={24}
        presence={avatar.presence}
        presenceLabel={avatar.presenceLabel}
      />
    );
  }
  if (row.kind === "group_dm") return <UsersIcon />;
  return row.isPrivate ? <LockIcon /> : <HashIcon />;
}

function Row({
  row,
  onOpenRow,
}: {
  row: ConversationRowData;
  onOpenRow: ConversationListProps["onOpenRow"];
}) {
  const unread = isCount(row.unreadCount) && row.isMuted !== true;
  return (
    <a
      className={cx("cr", unread && "un", row.isMuted === true && "mutec")}
      href={row.href}
      aria-current={row.current === true ? "page" : undefined}
      onClick={(event) => {
        if (!onOpenRow || !isPlainClick(event)) return;
        event.preventDefault();
        onOpenRow(row, event);
      }}
    >
      <span className="gl">
        <Glyph row={row} />
      </span>
      <span className="nm">{row.name}</span>
      {row.isPrivate === true && row.privateLabel !== undefined && (
        <span className="sr">{row.privateLabel}</span>
      )}
      {row.isMuted === true && row.mutedLabel !== undefined && (
        <span className="sr">{row.mutedLabel}</span>
      )}
      {row.deactivatedLabel !== undefined && <Tag>{row.deactivatedLabel}</Tag>}
      {row.isStarred === true && (
        <span className="star">
          <StarIcon size={14} />
          {row.starredLabel !== undefined && (
            <span className="sr">{row.starredLabel}</span>
          )}
        </span>
      )}
      {row.draftLabel !== undefined && row.current !== true && (
        <span className="draft">{row.draftLabel}</span>
      )}
      {row.hasMention === true && (
        <Badge variant="mention" label={row.mentionLabel}>
          @
        </Badge>
      )}
      {unread && <Badge label={row.unreadLabel}>{row.unreadCount}</Badge>}
    </a>
  );
}

// The conversation list of the sidebar: header, search, filters and groups (R3). It renders a
// fragment, because the `aside.convs` around it is the shell's; `ref` goes to the scrolling `div.clist`.
export const ConversationList = forwardRef<
  HTMLDivElement,
  ConversationListProps
>(function ConversationList(
  {
    title,
    browse,
    notice,
    search,
    filters,
    groups,
    onToggleGroup,
    onOpenRow,
    empty,
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <>
      <div className="ch">
        <h2>{title}</h2>
        {browse && (
          <IconButton
            icon="hash"
            size="sm"
            label={browse.label}
            onClick={browse.onPress}
          />
        )}
      </div>
      {notice}
      <div className="cfilter">
        <Field
          variant="search"
          icon="search"
          type="search"
          aria-label={search.label}
          placeholder={search.placeholder}
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
        />
        <ChipGroup aria-label={filters.label}>
          {filters.options.map((option) => (
            <Chip
              key={option.id}
              size="sm"
              pressed={option.id === filters.value}
              onClick={() => filters.onChange(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      <div {...rest} ref={ref} className={cx("clist", className)}>
        {groups.map((group) => {
          if (group.rows.length === 0 && group.keepWhenEmpty !== true)
            return null;
          const rowsId = `${baseId}-${group.id}`;
          return (
            <div key={group.id} className="cgroup" data-group={group.id}>
              <div className="sech">
                <button
                  type="button"
                  className={cx("sec", group.collapsed && "fold")}
                  aria-expanded={!group.collapsed}
                  aria-controls={rowsId}
                  onClick={() => onToggleGroup?.(group.id)}
                >
                  <DownIcon />
                  <span>{group.label}</span>
                  {group.collapsed && isCount(group.unreadCount) && (
                    <Badge className="sec-count" label={group.unreadLabel}>
                      {group.unreadCount}
                    </Badge>
                  )}
                </button>
                {group.action && (
                  <IconButton
                    icon="plus"
                    size="sm"
                    className="sec-add"
                    label={group.action.label}
                    onClick={group.action.onPress}
                  />
                )}
              </div>
              <div className="crows" id={rowsId} hidden={group.collapsed}>
                {!group.collapsed &&
                  group.rows.map((row) => (
                    <Row key={row.id} row={row} onOpenRow={onOpenRow} />
                  ))}
              </div>
            </div>
          );
        })}
        {total === 0 && empty && (
          <EmptyState
            icon="search"
            filtered
            title={empty.title}
            description={empty.description}
            action={
              <Button size="sm" onClick={empty.onAction}>
                {empty.actionLabel}
              </Button>
            }
          />
        )}
        {browse && (
          <button type="button" className="cr browse" onClick={browse.onPress}>
            <span className="gl">
              <PlusIcon />
            </span>
            <span className="nm">{browse.label}</span>
          </button>
        )}
      </div>
    </>
  );
});
