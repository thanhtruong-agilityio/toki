import { createUuidV7Generator } from "@toki/shared";
import { clock } from "./clock";

// The one file of apps/web/src that touches a random source (TOKI-025 R33). Every other file that
// needs a unique id imports `newId`. `crypto.randomUUID` is not used: it exists only in secure
// contexts, and Toki is self-hosted, so an Admin may reach it over plain http on a LAN address.
export const newId = createUuidV7Generator({
  clock,
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
});
