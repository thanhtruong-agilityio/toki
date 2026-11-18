// One address and nothing else (R6): a loose check could send a code to two people.
const FORBIDDEN = /[\s,;<>"()[\]\\\u0000-\u001f\u007f]/;

export function isWellFormedAddress(value: string): boolean {
  if (value.length > 254) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return !!local && !!domain && !FORBIDDEN.test(value);
}
