import type { ScreenDecl } from "../../support/parity";
import { LAUNCH, stubWorld } from "../../support/prototype-world";

// The screens of the app that have a counterpart in the prototype and are built (TOKI-141), shown on
// the prototype's sample data (e2e/support/prototype-world.ts). The conversation page, the Details
// panel, Browse channels and New message are compared at 1280 and 900 px only: on a narrow screen the
// prototype shows the list of conversations first and the app the open conversation, so the two are
// not the same screen there. A dialog of the app is drawn outside `.app`, so its picture is of the
// whole window (`appRoot: "html"`). Fake data only.
const setup = stubWorld;

export const channel: ScreenDecl = {
  id: "channel",
  section: "home",
  appRoute: `/c/${LAUNCH}`,
  ready: '[data-testid="conversation-page"]',
  // On a narrow screen the prototype shows the list of conversations first and the app the open
  // conversation, so the two are not the same screen there.
  widths: ["wide", "mid"],
  setup,
};

export const details: ScreenDecl = {
  id: "details",
  section: "home",
  prototypeSteps: [{ click: '[data-action="details"]' }],
  appRoute: `/c/${LAUNCH}`,
  ready: '[data-testid="conversation-page"]',
  appSteps: [{ click: '[aria-label="Members and details"]' }],
  widths: ["wide", "mid"],
  setup,
};

export const browse: ScreenDecl = {
  id: "browse",
  section: "home",
  prototypeSteps: [
    { click: 'button[data-action="browse"][aria-label="Browse channels"]' },
  ],
  appRoute: `/c/${LAUNCH}`,
  appRoot: "html",
  ready: '[data-testid="conversation-page"]',
  appSteps: [{ click: 'button[aria-label="Browse channels"]' }],
  widths: ["wide", "mid"],
  setup,
};

export const newMessage: ScreenDecl = {
  id: "new-message",
  section: "home",
  prototypeSteps: [{ click: 'button[data-action="newmsg"]' }],
  appRoute: `/c/${LAUNCH}`,
  appRoot: "html",
  ready: '[data-testid="conversation-page"]',
  appSteps: [{ click: 'button[aria-label="New message"]' }],
  widths: ["wide", "mid"],
  setup,
};

export const prefs: ScreenDecl = {
  id: "prefs",
  section: "prefs",
  appRoute: "/prefs",
  setup,
};
