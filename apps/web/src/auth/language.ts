import { resolveLanguage, type Language } from "@toki/i18n";
import type { Platform } from "@toki/platform";

export const LANGUAGE_KEY = "signIn.language";

// Before sign-in the page speaks the language last used on this device, else English; the browser's
// language is not asked (concern 3). This ticket adds no switch, so nothing writes the key yet.
export function readDeviceLanguage(platform: Platform): Language {
  return resolveLanguage(platform.storage.device.get(LANGUAGE_KEY));
}
