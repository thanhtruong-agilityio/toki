import { hasControl } from "./chars.js";

// One address and nothing else (R6): a loose check could send a code to two people.
const FORBIDDEN = /[\s,;<>"()[\]\\]/;

export function isWellFormedAddress(value: string): boolean {
  if (value.length > 254 || hasControl(value) || FORBIDDEN.test(value))
    return false;
  const parts = value.split("@");
  return parts.length === 2 && !!parts[0] && !!parts[1];
}
