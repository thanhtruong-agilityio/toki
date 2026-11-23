import type { MessageKey } from "@toki/i18n";

type Translate = (key: MessageKey) => string;

// The second line of the account card (R2): the role of the person, as the
// prototype shows the status or the role. It never returns the word that D-152
// removed. TOKI-056 changes only this function, to put a status first.
export function accountDetail(
  user: { role?: string | null },
  t: Translate,
): string | undefined {
  if (user.role === "member") return t("common.role.member");
  if (user.role === "admin") return t("common.role.admin");
  return undefined;
}
