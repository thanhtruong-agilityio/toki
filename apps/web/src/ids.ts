import { createUuidV7Generator } from "@toki/shared";
import { clock } from "./clock";

// The web app's one source of ids (TOKI-098 R2). This is the one file of apps/web/src that touches
// a random source: every other file that needs a unique id imports `newId`.
// `crypto.getRandomValues` works on a page served without HTTPS, unlike `crypto.randomUUID`, which
// needs a secure context (Toki is self-hosted, D-028).
export const newId: () => string = createUuidV7Generator({
  clock,
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
});
