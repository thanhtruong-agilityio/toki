import { useTranslation } from "@toki/i18n/react";
import { SectionPage } from "@toki/ui-web";

// The view of a person who may not open the Admin page (TOKI-025 R4): the title and nothing else, so
// it names nothing of the page, not even the page's own title. TOKI-082 builds the one shared view
// for 403 and 404 and then replaces the body of this file, keeping the file and its (no) props.
export function NoAccess() {
  const { t } = useTranslation();
  return <SectionPage title={t("admin.noAccess.title")} />;
}
