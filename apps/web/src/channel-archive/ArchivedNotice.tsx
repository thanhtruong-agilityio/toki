import { useTranslation } from "@toki/i18n/react";

// Where the composer sits in an ordinary conversation (R17, D-078): the one text of that place. It
// is not a control, and it is the same for an Admin and a Member.
export function ArchivedNotice() {
  const { t } = useTranslation();
  return (
    <p className="arch-notice" role="status">
      {t("archive.notice")}
    </p>
  );
}
