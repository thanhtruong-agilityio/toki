import type { Browser, DeviceKind } from "@toki/shared";

// The key of the word for a code of TOKI-026 R6. `list()` has already turned
// any other value into `unknown`. The code `other` is read from the key
// `otherBrowser`: the i18n check refuses a key part named `other`.
export const kindKey = (kind: DeviceKind) =>
  `account.devices.kind.${kind}` as const;
export const browserKey = (browser: Browser) =>
  (browser === "other"
    ? "account.devices.browser.otherBrowser"
    : `account.devices.browser.${browser}`) as
    | "account.devices.browser.chrome"
    | "account.devices.browser.edge"
    | "account.devices.browser.safari"
    | "account.devices.browser.firefox"
    | "account.devices.browser.otherBrowser"
    | "account.devices.browser.unknown";
