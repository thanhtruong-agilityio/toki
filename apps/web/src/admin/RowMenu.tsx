import { useTranslation } from "@toki/i18n/react";
import {
  canChangeRole,
  canDeactivateAccount,
  canReactivateAccount,
  type Decision,
  type MemberRole,
  type TargetPerson,
} from "@toki/shared";
import {
  IconButton,
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  useMenuTrigger,
} from "@toki/ui-web";
import type { ReactNode } from "react";
import type { MemberRowView } from "./adminApi";
import type { AdminActions } from "./useAdminAction";

const ROLES: readonly MemberRole[] = ["member", "admin"];

type Props = {
  row: MemberRowView;
  actor: { id: string; role: string };
  activeAdminCount: number;
  actions: AdminActions;
};

// The menu of an account row (TOKI-025 R15 to R17). Every choice comes from a permission function of
// `@toki/shared`: the page compares no role itself. A refusal it can explain (`last_admin`,
// `self_target`) draws a locked item with the reason inside it, so a touch user sees it and a screen
// reader reads it with the item; any other refusal leaves the item out, because a refusal the page
// cannot explain never shows a control.
export function RowMenu({ row, actor, activeAdminCount, actions }: Props) {
  const { t } = useTranslation();
  const trigger = useMenuTrigger<HTMLButtonElement>();
  if (row.userId === null) return null;

  const name = row.displayName ?? row.email;
  const label = t("admin.action.menu", { name });
  const target: TargetPerson = {
    id: row.userId,
    role: row.role,
    status: row.status === "deactivated" ? "deactivated" : "active",
  };
  const opener = () => trigger.triggerProps.ref.current;

  const locked = (key: string, text: ReactNode, reason: string) => (
    <MenuItem key={key} disabled>
      {text}
      <span className="adm-lock">{reason}</span>
    </MenuItem>
  );

  // The result of a permission function as an item: enabled, locked with its reason, or left out.
  const asItem = (
    key: string,
    decision: Decision,
    text: ReactNode,
    onSelect: () => void,
    danger = false,
  ) => {
    if (decision.allowed) {
      return (
        <MenuItem
          key={key}
          variant={danger ? "danger" : "default"}
          onClick={onSelect}
        >
          {text}
        </MenuItem>
      );
    }
    if (decision.reason === "last_admin")
      return locked(key, text, t("admin.lock.lastAdmin"));
    if (decision.reason === "self_target")
      return locked(key, text, t("admin.lock.self"));
    return null;
  };

  let items: ReactNode;
  if (target.status === "active") {
    const roleItems = ROLES.map((role) => {
      const text = t(`common.role.${role}`);
      if (role === row.role) return locked(role, text, t("admin.lock.current"));
      return asItem(
        role,
        canChangeRole(actor, target, role, activeAdminCount),
        text,
        () => actions.openChangeRole(row, role, opener()),
      );
    });
    const deactivate = asItem(
      "deactivate",
      canDeactivateAccount(actor, target, activeAdminCount),
      t("admin.action.deactivate"),
      () => actions.openDeactivate(row, opener()),
      true,
    );
    items = (
      <>
        <MenuGroup label={t("admin.action.changeRole")}>{roleItems}</MenuGroup>
        {deactivate ? <MenuSeparator /> : null}
        {deactivate}
      </>
    );
  } else {
    // No Change role for a deactivated person: they come back with the role they had and an Admin
    // changes it afterwards (R16, TOKI-024 R26, R30).
    items = asItem(
      "reactivate",
      canReactivateAccount(actor),
      t("admin.action.reactivate"),
      () => actions.openReactivate(row, opener()),
    );
  }

  return (
    <>
      <IconButton
        icon="more"
        size="sm"
        label={label}
        {...trigger.triggerProps}
      />
      <Menu {...trigger.menuProps} aria-label={label} align="end">
        {items}
      </Menu>
    </>
  );
}
