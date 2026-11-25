# Intent: Web Push
Author: Thanh Truong

## Problem
A person who has closed Toki, or left its tab hidden, misses what is meant for them: a mention, a message in a direct message, a reminder that is due. The notification decision engine (TOKI-073) decides that such a person should get a push, but nothing yet sends one. There is no key pair that identifies the server to the browsers' push services, no record of which devices of a person can receive a push, no way for a person to allow it, no service worker to show the notification, and nothing that says what a click on it does.

Three things make this more than a send call. The browser may be asked for permission only after the person presses a button (F36). On an iPhone a web app receives push only after it has been added to the Home Screen (D-108), so the person has to be told. And a device that signs out, or whose session is ended from another device, must stop receiving what belongs to the person who was signed in (D-158).

## Proposed outcome
A person who is signed in on a browser that supports it sees a small card on their first visit offering notifications. Only after they press Turn on does the browser ask. On approval the device is registered and a test notification appears. From then on, when the engine decides a push and none of the person's windows is in use, every registered device of the person shows a system notification with the sender, the conversation and the start of the message (D-044). Pressing it opens Toki at that message. Preferences shows the state of this device: on, off, blocked in the browser, or, on an iPhone outside the Home Screen, an explanation of the rule. Signing out, or having a session ended, removes the device's registration.

## Affected users and systems
- Every Member and Admin who wants notifications while Toki is closed or hidden. A Guest is a phase 5 role (D-090, D-152) and is not built here.
- The server (`apps/server`): the `notifications` module (the `devices` table is already there), the worker that runs the push job (TOKI-064), the configuration list and `.env.example` (TOKI-096).
- The web app (`apps/web`): the shell (the card), Preferences (the device block), the router (the click address), the sign-out sequence (TOKI-099), and `packages/platform` (the browser's push calls).
- The notification decision engine (TOKI-073), which hands over the push; Jump to message (TOKI-068), which opens the message; the notification preferences (TOKI-102), whose Desktop switch gates push; sessions (TOKI-022, TOKI-026).
- The PWA ticket (TOKI-077), which builds on the service worker file this ticket owns.
- The push services of the supported browsers, which carry the encrypted payload.

## Constraints
- The browser is asked for permission only after Turn on is pressed. Source: F36.
- On approval the device is registered and a test notification appears. Source: F36.
- A push shows the sender, the conversation and the start of the message. Source: D-044, FR-18 AC-045.
- Pressing the notification opens Toki at that message. Source: F36.
- No push arrives while that conversation is on screen. Source: F36; the rule is decided in TOKI-073.
- The service worker is used for push only. Source: D-030.
- On iPhone, push works only once Toki is added to the Home Screen, and Preferences says so. Source: D-108, F36.
- Permission refused: Preferences shows that notifications are blocked in the browser, with steps to turn them back on. Source: F36.
- Signing out removes that device's push registration. Source: D-158, F06.
- One set of notification switches for the person; only the browser's push permission is per device. Source: D-142.
- The VAPID keys are added to the configuration list and `.env.example`. Source: plan, TOKI-074; TOKI-096.
- Every text goes through i18n with English as the default; a wording the prototype does not contain is a proposal. The prototype has no card, no test notification and no push text. Source: NFR-05, D-139.
- Milestone M5, size L. Needs TOKI-068 and TOKI-073. Source: Toki Blueprint, ticket TOKI-074.

## Open questions
- When the person presses Later on the card, does the card come back, and when?
- Is the card offered when the person's Desktop notifications switch is off, and does Turn on change that switch?
- What does the push of a reminder show, and what is sent when the saved message was deleted?
- How does a click reach the app, which lives in React while the service worker does not, and what address does it open when no tab exists?
- Who owns the service worker file and its registration, now that the PWA ticket builds on it?
- Does an iPad follow the iPhone rule?
