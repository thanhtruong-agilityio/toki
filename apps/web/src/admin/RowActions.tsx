import { useTranslation } from "@toki/i18n/react";
import { canManageInvitations } from "@toki/shared";
import { Button } from "@toki/ui-web";
import type { MemberRowView } from "./adminApi";
import { RowMenu } from "./RowMenu";
import type { AdminActions } from "./useAdminAction";

type Props = {
  row: MemberRowView;
  actor: { id: string; role: string };
  activeAdminCount: number;
  // The id of the name cell: each button is named for its row through it (R15).
  nameCellId: string;
  actions: AdminActions;
};

// The last cell of a row (TOKI-025 R15). An invitation has Resend and Revoke on the row and not in a
// menu, as journey F02 says; an account has the menu button, which is always drawn and never only on
// hover (D-067).
export function RowActions({
  row,
  actor,
  activeAdminCount,
  nameCellId,
  actions,
}: Props) {
  const { t } = useTranslation();
  if (row.kind === "invitation" || row.invitation !== null) {
    if (row.kind !== "invitation") {
      // A deactivated person with a pending invitation is an account row (concern 1).
      return (
        <RowMenu
          row={row}
          actor={actor}
          activeAdminCount={activeAdminCount}
          actions={actions}
        />
      );
    }
    if (!canManageInvitations(actor).allowed) return null;
    const id = row.invitation?.id ?? "";
    return (
      <>
        <Button
          size="sm"
          aria-describedby={nameCellId}
          disabled={actions.isResending(id)}
          onClick={() => actions.resend(row)}
        >
          {t("admin.action.resend")}
        </Button>{" "}
        <Button
          size="sm"
          aria-describedby={nameCellId}
          onClick={(event) => actions.openRevoke(row, event.currentTarget)}
        >
          {t("admin.action.revoke")}
        </Button>
      </>
    );
  }
  return (
    <RowMenu
      row={row}
      actor={actor}
      activeAdminCount={activeAdminCount}
      actions={actions}
    />
  );
}
