import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import { useState, type ReactNode } from "react";
import { readDeviceLanguage } from "./auth/language";
import { queryClient } from "./query-client";

// The providers of the app, in one place so a test mounts the same ones as `main.tsx`. The language is
// the one last used on this device, else English (TOKI-023, plan decision 5).
export function AppProviders({ children }: { children?: ReactNode }) {
  const [language] = useState(() => readDeviceLanguage(getPlatform()));
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider language={language}>{children}</I18nProvider>
    </QueryClientProvider>
  );
}
