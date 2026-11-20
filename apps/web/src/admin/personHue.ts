// The colour of a person's avatar, 0 to 359, from a seed that does not change (the user id, or the
// address of an invitation). A stop-gap: TOKI-033 builds the shared `personHue` (R28 there) and this
// file is then replaced by it.
export function personHue(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
  }
  // A final mix, so seeds that differ in their last character do not land on neighbouring hues.
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) >>> 0;
  return hash % 360;
}
