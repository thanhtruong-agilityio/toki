// Lists the namespace files of this language (R13). A new namespace is added here and in en/index.ts.
import type { Catalog } from "../../catalog";
import { common } from "./common";
import { createChannel } from "./createChannel";
import { emergency } from "./emergency";
import { mail } from "./mail";
import { nav } from "./nav";
import { picker } from "./picker";
import { sessionEnded } from "./sessionEnded";
import { signIn } from "./signIn";

export const vi: Catalog = {
  common,
  createChannel,
  emergency,
  mail,
  nav,
  picker,
  sessionEnded,
  signIn,
};
