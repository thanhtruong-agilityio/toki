export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_LOCAL_MAX_LENGTH = 64;

const LOCAL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

// The address trimmed and in lower case when it is well-formed, else null
// (TOKI-020 R16). Plain code, no Zod: no library version decides what is valid.
export function parseEmail(value: string): string | null {
  const address = value.trim();
  if (address.length === 0 || address.length > EMAIL_MAX_LENGTH) return null;
  if (/\s/.test(address)) return null;
  const parts = address.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts as [string, string];
  if (local.length < 1 || local.length > EMAIL_LOCAL_MAX_LENGTH) return null;
  if (!LOCAL.test(local)) return null;
  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((label) => LABEL.test(label))) return null;
  return address.toLowerCase();
}
