import {
  createApiClient,
  createConversationStore,
  reportUnauthenticated,
} from "@toki/client-core";
import { createTimers } from "./timers";

// The one API client, the one timers object and the one conversation store of
// the web app (TOKI-032 R25). Only this file makes a client or a store. It
// sends no request: the screen that shows the list calls `conversations.load()`
// when the session becomes signed in and `conversations.reset()` when it stops
// being signed in or another person signs in.
export const timers = createTimers();
export const api = createApiClient({ timers });
// Every 401 with one of the three session codes reaches the session state.
api.setOnUnauthenticated(reportUnauthenticated);
export const conversations = createConversationStore({ api });
