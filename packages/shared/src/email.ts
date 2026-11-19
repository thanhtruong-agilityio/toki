// One definition of a well-formed address, in plain code with no schema
// library, so no library version decides it. Used by the configuration, the
// sign-in and the invitation code (TOKI-020 R16).
export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_LOCAL_MAX_LENGTH = 64;

const localPart = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const label = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

// The address trimmed and in lower case when it is well-formed, else null.
export function parseEmail(value: string): string | null {
  const address = value.trim();
  if (address.length === 0 || address.length > EMAIL_MAX_LENGTH) return null;
  const parts = address.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts as [string, string];
  if (local.length < 1 || local.length > EMAIL_LOCAL_MAX_LENGTH) return null;
  if (!localPart.test(local)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => label.test(l))) return null;
  return address.toLowerCase();
}
