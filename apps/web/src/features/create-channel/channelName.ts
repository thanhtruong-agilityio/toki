import { CHANNEL_NAME_PATTERN, isValidChannelTopic } from "@toki/shared";

// A space becomes a hyphen and a capital a lower-case letter, and nothing else
// changes (D-127, R6). Not trimmed: a space typed at the end shows as a hyphen.
export function normalizeChannelName(text: string): string {
  return text.replace(/\s/gu, "-").toLowerCase();
}

export type NameVerdict =
  { valid: true } | { valid: false; message: "invalid" | "tooLong" | null };

// The verdict is the shared pattern's, so the screen and the server cannot
// disagree (R7). An empty name has no message: an untouched form shows no error.
export function validateChannelName(name: string): NameVerdict {
  if (CHANNEL_NAME_PATTERN.test(name)) return { valid: true };
  if (name === "") return { valid: false, message: null };
  if (/[^a-z0-9-]/.test(name)) return { valid: false, message: "invalid" };
  return { valid: false, message: "tooLong" };
}

export type TopicVerdict =
  { valid: true; topic: string | null } | { valid: false };

// The topic is trimmed before it is checked and sent; white space alone is no
// topic (R8).
export function validateChannelTopic(text: string): TopicVerdict {
  const topic = text.trim();
  if (topic === "") return { valid: true, topic: null };
  return isValidChannelTopic(topic) ? { valid: true, topic } : { valid: false };
}
