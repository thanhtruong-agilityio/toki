// The values of the event log (TOKI-036 R22). The check of `events.scope` is
// written from the scopes, so a change needs a new migration.

// Who an event is for.
export const EVENT_SCOPES = ["workspace", "conversation", "user"] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];

export const EVENT_RETENTION_DAYS = 7;
export const EVENT_PRUNE_INTERVAL_MS = 3_600_000;
