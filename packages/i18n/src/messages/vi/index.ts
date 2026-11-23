// Lists the namespace files of this language (R13). A new namespace is added here and in en/index.ts.
import type { Catalog } from "../../catalog";
import { account } from "./account";
import { admin } from "./admin";
import { common } from "./common";
import { conversationList } from "./conversationList";
import { createChannel } from "./createChannel";
import { emergency } from "./emergency";
import { join } from "./join";
import { mail } from "./mail";
import { nav } from "./nav";
import { picker } from "./picker";
import { sessionEnded } from "./sessionEnded";
import { signIn } from "./signIn";

export const vi: Catalog = {
  account,
  admin,
  common,
  conversationList,
  createChannel,
  emergency,
  join,
  mail,
  nav,
  picker,
  sessionEnded,
  signIn,
};
