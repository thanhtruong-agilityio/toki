import { useTranslation } from "@toki/i18n/react";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  type MenuTriggerMenuProps,
} from "@toki/ui-web";
import "./account.css";
import { useAccountEntries, type AccountItem } from "./account-entries";
import { useSigningOut } from "./sign-out";

// The menu of the account card (R5): a `Menu` of TOKI-014 on the card's menu
// props, drawn as a sibling of the shell and never inside `button.ucard`. It
// draws the registered entries in their fixed order: an item as a `MenuItem`,
// a group as a `MenuGroup` followed by a separator, as the prototype does. It
// holds no other element; the status text for a screen reader is outside it.
export function AccountMenu({
  menuProps,
}: {
  menuProps: MenuTriggerMenuProps<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const entries = useAccountEntries();
  const signingOut = useSigningOut();
  const item = (it: AccountItem, key: string) => (
    <MenuItem
      key={key}
      variant={it.variant}
      icon={it.icon}
      disabled={it.disabled}
      onClick={it.onSelect}
    >
      {it.label}
    </MenuItem>
  );
  return (
    <>
      <Menu {...menuProps} align="start" aria-label={t("account.menu.label")}>
        {entries.flatMap((entry, index) =>
          "items" in entry
            ? [
                <MenuGroup key={entry.id} label={entry.heading}>
                  {entry.items.map((it, i) => item(it, it.id ?? String(i)))}
                </MenuGroup>,
                <MenuSeparator key={`${entry.id}-rule`} />,
              ]
            : [item(entry, entry.id ?? `entry-${index}`)],
        )}
      </Menu>
      <span className="acct-status" role="status">
        {signingOut ? t("account.signingOut") : ""}
      </span>
    </>
  );
}
