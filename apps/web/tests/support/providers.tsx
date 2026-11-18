import { I18nProvider } from "@toki/i18n/react";
import { ToastProvider } from "@toki/ui-web";
import type { ReactNode } from "react";

// The providers that the patterns need: texts and the toast region.
export function Providers({ children }: { children?: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}
