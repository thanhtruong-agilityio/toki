// The numbers and shapes of member management (TOKI-024 R35). The server and
// the screens read them from here; nothing else writes them down.
export const INVITATION_BATCH_MAX = 50;
export const INVITATION_LIFETIME_DAYS = 7;
export const INVITATION_RESEND_SECONDS = 60;
// 32 random bytes written as base64url (R11).
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// The value of the Idempotency-Key header (R13).
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MEMBER_LIST_LIMIT_DEFAULT = 50;
export const MEMBER_LIST_LIMIT_MAX = 100;
