// A person's avatar colour (TOKI-033 R28): an integer from 0 to 359 that is a
// function of the id alone, so a person has the same colour on every screen
// and device with nothing stored. FNV-1a 32-bit over the UTF-8 bytes of the
// lower-cased id, modulo 360. TOKI-099 needs it for the account card and adds
// it here, where TOKI-033 says it lives; TOKI-033 keeps this file.
export function personHue(personId: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(personId.toLowerCase())) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
}
