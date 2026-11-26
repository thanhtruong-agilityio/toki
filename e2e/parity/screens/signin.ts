import type { ScreenDecl } from "../../support/parity";
import { codeAccepted, ok, stubAuth } from "../../support/sign-in";

// The sign-in page of the app (`/login`) against the prototype's guest sign-in card (TOKI-137). The
// prototype opens already signed in and has no other sign-in screen: its guest card, opened at the
// hash `#guest`, shows the email step and then the code step. The page is outside the shell of the
// app, so the element that is captured is `#root` and not `.app`. Fake data only.
const EMAIL = "linh@saigoncoffee.example"; // the address that the prototype's card holds

const setup: ScreenDecl["setup"] = async (page) => {
  await stubAuth(page, {
    workspace: () => ok({ name: "Hugepig Studio" }), // the name on the prototype's card
    codes: () => codeAccepted(30),
  });
};

export const signinEmail: ScreenDecl = {
  id: "signin-email",
  section: "guest",
  appRoute: "/login",
  appRoot: "#root",
  ready: 'input[type="email"]',
  appSteps: [{ fill: ['input[type="email"]', EMAIL] }],
  setup,
};

export const signinCode: ScreenDecl = {
  id: "signin-code",
  section: "guest",
  prototypeSteps: [{ click: '[data-action="gsend"]' }],
  appRoute: "/login",
  appRoot: "#root",
  // The email field is gone once the code step shows, so the wait is for the card.
  ready: ".gcard",
  appSteps: [
    { fill: ['input[type="email"]', EMAIL] },
    { click: "text=Send code" },
    // Clicking the code field waits for it, so that the capture is of the code step.
    { click: ".inp.code" },
  ],
  setup,
};
