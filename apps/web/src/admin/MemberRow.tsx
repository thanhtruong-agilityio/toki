import { useTranslation } from "@toki/i18n/react";
import { formatDate, formatDateTime, type FormatContext } from "@toki/shared";
import { Avatar, Tag } from "@toki/ui-web";
import type { FocusEventHandler, ReactNode } from "react";
import type { MemberRowView } from "./adminApi";
import { personHue } from "./personHue";

// The glyph for a value that is not there (R13).
const NONE = "—";

export type MemberRowProps = {
  row: MemberRowView;
  actorId: string;
  ctx: FormatContext;
  // The id of the name cell: the row's buttons name themselves through it (R15).
  nameCellId: string;
  // The last cell: Resend and Revoke, or the row's menu (R15).
  actions?: ReactNode;
  onFocus?: FocusEventHandler<HTMLTableRowElement>;
};

// One row of the members table (TOKI-025 R12, R13). Nothing in it is a link: no part of the page
// leads to a profile, a conversation or a message (F39).
export function MemberRow({
  row,
  actorId,
  ctx,
  nameCellId,
  actions,
  onFocus,
}: MemberRowProps) {
  const { t } = useTranslation();
  const isInvitation = row.kind === "invitation";
  const title = isInvitation ? row.email : (row.displayName ?? row.email);
  const invitation = isInvitation ? row.invitation : null;

  // An invitation whose mail did not go out reads "Mail not sent" and not "Invited"; an expired one
  // reads Expired whatever its mail status (D-099, AC-067).
  const status =
    row.invitation?.state === "pending" &&
    row.invitation.mailStatus === "failed" &&
    isInvitation
      ? t("admin.row.mailNotSent")
      : t(`admin.status.${row.status}`);

  const lastActive =
    isInvitation || row.lastActiveAt === null
      ? null
      : formatDateTime(row.lastActiveAt, ctx);

  return (
    <tr role="row" onFocus={onFocus}>
      <td role="cell" id={nameCellId}>
        <div className="adm-name">
          <Avatar name={title} hue={personHue(row.userId ?? row.email)} />
          <div>
            <b>{title}</b>
            {row.userId === actorId ? (
              <>
                {" "}
                <Tag>{t("admin.row.you")}</Tag>
              </>
            ) : null}
            {isInvitation ? null : <span className="adm-sub">{row.email}</span>}
            {invitation ? (
              <span className="adm-sub">
                {t("admin.row.invitedBy", {
                  name: invitation.invitedBy.displayName,
                  date:
                    invitation.createdAt === null
                      ? NONE
                      : (formatDate(invitation.createdAt, ctx) ?? NONE),
                })}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td role="cell" data-label={t("admin.col.role")}>
        {t(`common.role.${row.role}`)}
      </td>
      <td role="cell" data-label={t("admin.col.status")}>
        {status}
      </td>
      <td role="cell" data-label={t("admin.col.lastActive")}>
        {lastActive ?? NONE}
      </td>
      <td role="cell" className="adm-actions">
        {actions}
      </td>
    </tr>
  );
}
