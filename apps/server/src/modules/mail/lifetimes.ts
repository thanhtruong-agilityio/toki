// The lifetimes the mails state (R26), held here until the constants they come
// from exist: CODE_TTL_SECONDS of TOKI-022 (packages/shared/src/auth/limits.ts)
// and INVITATION_LIFETIME_DAYS of TOKI-024 (packages/shared/src/members/). When
// they do, import them here and compare in the test.
export const CODE_TTL_MINUTES = 10; // D-136
export const INVITATION_LIFETIME_DAYS = 7; // D-037
