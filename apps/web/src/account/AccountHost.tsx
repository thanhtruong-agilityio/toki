import { useRouter } from "@tanstack/react-router";
import { getSessionState } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import type { MenuTriggerMenuProps } from "@toki/ui-web";
import { useEffect } from "react";
import { AccountMenu } from "./AccountMenu";
import { useRegisterAccountEntry } from "./account-entries";
import { endLocalSession, useSigningOut, useSignOut } from "./sign-out";

// Rendered as a child of `AppShell`, so inside its toast provider: the sign-out
// toast and the offline explanation need one, and a second provider would add a
// second live region that the shell does not anchor. It registers the two
// entries this ticket builds (R4), listens for the signal of other tabs (R12)
// and draws the menu (R5).
export function AccountHost({
  menuProps,
}: {
  menuProps: MenuTriggerMenuProps<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  const signingOut = useSigningOut();

  useRegisterAccountEntry("preferences", {
    label: t("nav.preferences"),
    icon: "settings",
    onSelect: () => {
      void router.navigate({ to: "/prefs" });
    },
  });
  useRegisterAccountEntry("signOut", {
    label: t("account.entry.signOut"),
    disabled: signingOut,
    onSelect: () => {
      void signOut();
    },
  });

  // R12: while this tab is signed in, a `signedOut` message of another tab
  // ends this tab's session with no request to the server.
  useEffect(
    () =>
      getPlatform().tabs.subscribe((message) => {
        if (message.type !== "signedOut") return;
        if (getSessionState().status !== "signedIn") return;
        endLocalSession(router);
      }),
    [router],
  );

  return <AccountMenu menuProps={menuProps} />;
}
