// The colour of a person's avatar, from the id alone (R28): FNV-1a 32-bit over the UTF-8 bytes
// of the lower-cased id, modulo 360. Pure, so it is the same on every device and every screen.
export function personHue(personId: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(personId.toLowerCase())) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash % 360;
}
