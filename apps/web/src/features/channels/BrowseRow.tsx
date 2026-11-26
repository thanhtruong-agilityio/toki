import { useTranslation } from "@toki/i18n/react";
import type { ChannelSummary } from "@toki/shared";
import { Button, HashIcon, LockIcon, Tag } from "@toki/ui-web";
import type { ReactNode } from "react";
import { browseRowAction } from "./browseRows";
import "../rows.css";

export type BrowseRowProps = {
  channel: ChannelSummary;
  onOpen: () => void;
  onJoin: () => void;
  // Every Join of the dialog is disabled while one join runs; the pressed one is busy (D-111).
  joinDisabled: boolean;
  joining: boolean;
  // Drawn after the row's own button and not at all when absent: the one place where another ticket
  // adds a control to a row (TOKI-101's "Restore").
  extra?: ReactNode;
};

// One channel of Browse channels (R6, R7). It shows only what the server sends a person who is not a
// member: name, topic and member count.
export function BrowseRow({
  channel,
  onOpen,
  onJoin,
  joinDisabled,
  joining,
  extra,
}: BrowseRowProps) {
  const { t } = useTranslation();
  const action = browseRowAction(channel);
  // The line has two parts (TOKI-140): the word Private and the topic, which are cut with an ellipsis
  // when they do not fit, and the member count, which is never cut. The text is the same as one line.
  const lead = [
    channel.isPrivate ? t("browse.row.private") : null,
    channel.topic,
  ]
    .filter((part): part is string => part !== null && part !== "")
    .join(" · ");
  const count = t("browse.row.members", { count: channel.memberCount });

  return (
    <li className="prow">
      <span className="gl">
        {channel.isPrivate ? <LockIcon /> : <HashIcon />}
      </span>
      <span className="grow">
        {/* A long name or topic is cut with an ellipsis: the global `.ell`, and `display:block` as the
            prototype's own inline style does for `.sub` (line 2158), since Table A has no rule for the name. */}
        <b className="ell" style={{ display: "block" }}>
          {channel.name}
        </b>
        <span className="xs muted sub sub-line">
          {lead !== "" ? <span className="ell sub-lead">{lead}</span> : null}
          <span className="sub-count">
            {lead !== "" ? " · " : ""}
            {count}
          </span>
        </span>
      </span>
      {channel.archived ? <Tag>{t("browse.row.archived")}</Tag> : null}
      {action === "open" ? (
        <Button size="sm" onClick={onOpen}>
          {t("browse.row.open")}
        </Button>
      ) : action === "join" ? (
        <Button
          size="sm"
          variant="primary"
          disabled={joinDisabled}
          aria-busy={joining ? "true" : undefined}
          onClick={onJoin}
        >
          {t("browse.row.join")}
        </Button>
      ) : null}
      {extra}
    </li>
  );
}
