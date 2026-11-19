// The numbers of the sign-in rules (TOKI-022 R38). The server and the screens
// read them from here; nothing else writes them down.
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 600;
export const CODE_MAX_WRONG_TRIES = 5;
export const CODE_REQUESTS_MAX = 5;
export const CODE_REQUESTS_WINDOW_SECONDS = 900;
export const CODE_RESEND_SECONDS = 60;
export const CODE_IP_REQUESTS_MAX = 20;
export const SESSION_IDLE_DAYS = 30;
// TOKI-026 R24: an emergency link is valid for 10 minutes.
export const EMERGENCY_LINK_TTL_SECONDS = 600;
