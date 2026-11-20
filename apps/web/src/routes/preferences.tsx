import { createRoute } from "@tanstack/react-router";
import { useTranslation } from "@toki/i18n/react";
import { SectionPage } from "@toki/ui-web";
import { SignedInDevices } from "../account/SignedInDevices";
import { appLayoutRoute } from "./app-layout";

// The Preferences page, first form (R21). TOKI-078 owns the page from the
// moment this frame is built and adds its sections around the devices section.
export function PreferencesPage() {
  const { t } = useTranslation();
  return (
    <SectionPage title={t("nav.preferences")}>
      <div className="prefs">
        <SignedInDevices />
      </div>
    </SectionPage>
  );
}

export const preferencesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/prefs",
  component: PreferencesPage,
});
