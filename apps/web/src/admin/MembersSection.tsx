import { classifyApiError } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import type { MemberStatus } from "@toki/shared";
import { Button, Chip, ChipGroup, EmptyState, Field } from "@toki/ui-web";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { timers } from "../client";
import type { MemberRowView } from "./adminApi";
import "./admin.css";
import { MemberRow } from "./MemberRow";
import { RowActions } from "./RowActions";
import { useAdminAction } from "./useAdminAction";
import { useDateContext } from "./useDateContext";
import type { KeyPerId } from "./useKeyPerId";
import { useKeyPerId } from "./useKeyPerId";
import { useLoadMore } from "./useLoadMore";
import type { useMemberList } from "./useMemberList";

// The typed text reaches the query after this long without a key: one request for each key press
// would load the server and flicker the table (R7).
const SEARCH_DEBOUNCE_MS = 300;

type MemberList = ReturnType<typeof useMemberList>;

const CHIPS: Array<{ status: MemberStatus | undefined; label: string }> = [
  { status: undefined, label: "admin.filter.all" },
  { status: "active", label: "admin.status.active" },
  { status: "invited", label: "admin.status.invited" },
  { status: "expired", label: "admin.status.expired" },
  { status: "deactivated", label: "admin.status.deactivated" },
] as const;

export type MembersSectionProps = {
  list: MemberList;
  actor: { id: string; role: string };
  // The page's idempotency keys, shared with the invite dialog (R20); the section makes its own when
  // it is rendered alone.
  keys?: KeyPerId;
  // The last cell of a row. By default Resend and Revoke on an invitation and the menu of a person
  // (R15); a test passes its own.
  renderActions?: (
    row: MemberRowView,
    context: { nameCellId: string },
  ) => ReactNode;
};

const rowKey = (row: MemberRowView) =>
  `${row.kind}:${row.userId ?? row.invitation?.id ?? row.email}`;

// The members section of the Admin page: heading, search, status chips and the table with its
// empty, loading and failed views (TOKI-025 R7, R8, R11 to R14, R9).
export function MembersSection({
  list,
  actor,
  keys,
  renderActions,
}: MembersSectionProps) {
  const { t } = useTranslation();
  const ctx = useDateContext();
  const headingId = useId();
  const idBase = useId();
  const { setQuery } = list;
  // The focus goes to the heading when the row that opened a dialog has gone (R19).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ownKeys = useKeyPerId();
  const actions = useAdminAction({
    reload: list.reload,
    headingRef,
    keys: keys ?? ownKeys,
  });

  // Search: the displayed text is set at once and the query's search after 300 ms without a key.
  const [text, setText] = useState("");
  const cancelSearch = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelSearch.current?.(), []);
  const onSearch = (value: string) => {
    setText(value);
    cancelSearch.current?.();
    cancelSearch.current = timers.after(SEARCH_DEBOUNCE_MS, () => {
      cancelSearch.current = null;
      setQuery({ search: value });
    });
  };

  const sentinel = useLoadMore(list.loadMore, {
    enabled: list.hasMore && list.status === "ready",
    watch: list.rows.length,
  });

  const total =
    list.counts.active +
    list.counts.invited +
    list.counts.expired +
    list.counts.deactivated;
  const totalOf = (status: MemberStatus | undefined) =>
    status === undefined ? total : list.counts[status];

  const unreadable =
    list.error !== null && classifyApiError(list.error) === "unreadable";
  const errorLine = list.error ? (
    <div className="adm-error">
      <p>
        {unreadable ? t("admin.error.unreadable") : t("admin.members.error")}
      </p>
      {list.error.requestId ? (
        <p>{t("admin.error.id", { id: list.error.requestId })}</p>
      ) : null}
      {unreadable ? null : (
        <Button
          size="sm"
          onClick={() => {
            if (list.moreFailed) list.loadMore();
            else void list.reload();
          }}
        >
          {t("admin.error.retry")}
        </Button>
      )}
    </div>
  ) : null;

  let content: ReactNode;
  if (list.status === "loading") {
    content = <p role="status">{t("admin.members.loading")}</p>;
  } else if (list.status === "failed") {
    content = errorLine;
  } else if (list.rows.length === 0) {
    content = (
      <>
        <EmptyState
          icon="users"
          title={t("admin.members.empty.title")}
          description={t("admin.members.empty.hint")}
          filtered
        />
        {errorLine}
      </>
    );
  } else {
    const last = list.rows.length - 1;
    content = (
      <>
        <table
          className="adm-table"
          role="table"
          aria-labelledby={headingId}
          aria-busy={list.isRefreshing || list.isLoadingMore}
        >
          <thead>
            <tr role="row">
              <th role="columnheader" scope="col">
                {t("admin.col.name")}
              </th>
              <th role="columnheader" scope="col">
                {t("admin.col.role")}
              </th>
              <th role="columnheader" scope="col">
                {t("admin.col.status")}
              </th>
              <th role="columnheader" scope="col">
                {t("admin.col.lastActive")}
              </th>
              <th role="columnheader" scope="col" className="sr">
                {t("admin.col.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row, index) => {
              const nameCellId = `${idBase}-${rowKey(row)}`;
              return (
                <MemberRow
                  key={rowKey(row)}
                  row={row}
                  actorId={actor.id}
                  ctx={ctx}
                  nameCellId={nameCellId}
                  actions={
                    renderActions ? (
                      renderActions(row, { nameCellId })
                    ) : (
                      <RowActions
                        row={row}
                        actor={actor}
                        activeAdminCount={list.activeAdminCount}
                        nameCellId={nameCellId}
                        actions={actions}
                      />
                    )
                  }
                  // Focus entering the last row asks the next page too, so a person with a keyboard
                  // only can reach it (R9).
                  onFocus={index === last ? list.loadMore : undefined}
                />
              );
            })}
          </tbody>
        </table>
        <div ref={sentinel} className="adm-sentinel" />
        {errorLine}
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="adm-section">
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        {t("admin.members.title")}
      </h2>
      <div className="adm-toolbar">
        <Field
          variant="search"
          icon="search"
          aria-label={t("admin.members.search.label")}
          placeholder={t("admin.members.search.placeholder")}
          value={text}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <ChipGroup aria-label={t("admin.members.filter.label")}>
        {CHIPS.map(({ status, label }) => (
          <Chip
            key={label}
            pressed={list.query.status === status}
            onClick={() => setQuery({ status })}
          >
            {t(label as "admin.filter.all")}{" "}
            <span className="adm-count">{totalOf(status)}</span>
          </Chip>
        ))}
      </ChipGroup>
      {content}
      {actions.dialogs}
    </section>
  );
}
