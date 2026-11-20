import { useTranslation } from "@toki/i18n/react";
import { SectionPage } from "@toki/ui-web";
import { AdminNotices } from "./notices";

// The Admin page inside the shell's section frame (TOKI-025 R1). The sections are added by the
// tasks that build them.
export function AdminPage() {
  const { t } = useTranslation();
  return (
    <SectionPage title={t("nav.admin")}>
      <AdminNotices />
    </SectionPage>
  );
}
