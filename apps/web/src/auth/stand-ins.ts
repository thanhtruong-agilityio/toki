// STAND-INS for two things of other tickets that are not on `main` yet: `CODE_LENGTH` of
// packages/shared/src/auth/limits.ts and `parseEmail` of TOKI-020 R16 (TOKI-022 R7). Step 7 of
// docs/plans/TOKI-023.md replaces both with the shared ones, so no number of this ticket stays (R9).
export const CODE_LENGTH = 6;

export function isValidEmail(address: string): boolean {
  return (
    address.length <= 254 &&
    /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/.test(
      address,
    )
  );
}
