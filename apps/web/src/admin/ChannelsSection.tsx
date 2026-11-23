import { classifyApiError } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { Button, Icon, Tag } from "@toki/ui-web";
import { useId, type ReactNode } from "react";
import "./admin.css";
import { useChannelList } from "./useChannelList";
import { useLoadMore } from "./useLoadMore";

export type ChannelsSectionProps = {
  // The place of the "+" that creates a channel (TOKI-098's `CreateChannelButton`). It gets the
  // list's `reload`, called with no argument. Nothing is drawn when it is not given, so no dead "+"
  // exists before both tickets have landed; whichever of TOKI-025 and TOKI-098 lands second adds the
  // one import and the one line that passes it (R25).
  headingAction?: (reload: () => void) => ReactNode;
};

// The Channels section below the members (TOKI-025 R25, R32): a plain list of the channels the route
// returns, with their member counts. A row leads nowhere: the page leads to no message content.
export function ChannelsSection({ headingAction }: ChannelsSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const list = useChannelList();

  const sentinel = useLoadMore(list.loadMore, {
    enabled: list.hasMore && list.status === "ready",
    watch: list.rows.length,
  });

  const unreadable =
    list.error !== null && classifyApiError(list.error) === "unreadable";
  const errorLine = list.error ? (
    <div className="adm-error">
      <p>
        {unreadable ? t("admin.error.unreadable") : t("admin.channels.error")}
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
    content = <p role="status">{t("admin.channels.loading")}</p>;
  } else if (list.status === "failed") {
    content = errorLine;
  } else {
    content = (
      <>
        {list.rows.length > 0 ? (
          <table
            className="adm-table"
            role="table"
            aria-labelledby={headingId}
            aria-busy={list.isRefreshing || list.isLoadingMore}
          >
            <tbody>
              {list.rows.map((channel) => (
                <tr role="row" key={channel.id}>
                  <td role="cell">
                    <div className="adm-name">
                      <Icon name={channel.isPrivate ? "lock" : "hash"} />
                      <b>{channel.name}</b>
                      {channel.archived ? (
                        <Tag>{t("admin.channels.archived")}</Tag>
                      ) : null}
                    </div>
                  </td>
                  <td role="cell">
                    {t("admin.channels.members", {
                      count: channel.memberCount,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div ref={sentinel} className="adm-sentinel" />
        {errorLine}
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="adm-section">
      <div className="adm-heading-row">
        <h2 id={headingId}>{t("nav.channels")}</h2>
        {headingAction?.(() => void list.reload())}
      </div>
      {content}
    </section>
  );
}
