// The values of a message (TOKI-036 R22). The checks of the table `messages`
// are written from them, so a change needs a new migration.

// Counted in code points, like char_length of Postgres (D-042).
export const MESSAGE_TEXT_MAX = 10_000;

export const MESSAGE_KINDS = ["user", "system"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
