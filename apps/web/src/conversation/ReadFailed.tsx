import { useTranslation } from "@toki/i18n/react";
import { Button } from "@toki/ui-web";
import { readFailure } from "./readFailure";

// The failure of a read, in the place of what it would have drawn (R14): the text, and a Retry when
// a repeat can work. `no_access` and the kinds the client handles draw nothing here.
export function ReadFailed({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const view = readFailure(error);
  if (view === "no_access" || view === "none") return null;
  return (
    <div className="dp-empty">
      <p className="sm">{t("conversation.panel.readFailed")}</p>
      {view === "retry" && (
        <Button size="sm" onClick={onRetry}>
          {t("conversation.panel.retry")}
        </Button>
      )}
    </div>
  );
}
