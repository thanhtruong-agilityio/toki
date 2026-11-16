# Sign-in screens design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/sign-in-screens.md (Thanh Truong)
Ticket: TOKI-023

## Goal
A Member or an Admin needs a way into Toki: enter an email address, type the 6-digit code from the mail, and be in the app, with no password and no welcome step. The prototype has no sign-in screen, and the Sign-in API (TOKI-022) shows nothing to a person.
This ticket builds the two steps of the sign-in page, what the person sees for each of the 7 error cases of journey F05, and the 'Your session has ended' screen of journey F07. It targets the web app at every supported width, with the keyboard alone, in English and Vietnamese.

## Scope
- In:
  - The sign-in page at `/login` with its two steps: the email step and the 'Check your email' step.
  - The 7 error cases of journey F05 and what the person sees for each.
  - Sending a person without a session to the sign-in page, and a person with a session past it.
  - The 'Your session has ended' screen and its deactivated form (journey F07).
  - The small piece of `client-core` these screens need: the session state and the calls to the Sign-in API.
  - The English and Vietnamese text keys of these screens.
- Out (not now):
  - The server side: codes, limits, sessions, the cookie, the answers themselves. That is TOKI-022. This ticket only shows what the server answers and enforces none of the limits itself.
  - The sign-in mail and its templates: TOKI-021.
  - Accepting an invitation, its code step and its refusal pages: TOKI-097. The hand-off: TOKI-097 sends a person whose invitation was already used to `/login` with the email filled in (design, "Routes and state"), and may reuse the code step component of this ticket.
  - 'Sign out', the account menu and the signed-in devices list: TOKI-099. The hand-off: after Sign out the app shows `/login`; this ticket supplies that page and the session state TOKI-099 changes.
  - The emergency sign-in link: TOKI-026. It opens the app directly and never shows these screens.
  - The guest portal sign-in (phase 5).
  - The base components (Button, Field) and the Modal: TOKI-012 and TOKI-014. This ticket adds no new base component.
  - Keeping the composer draft across a sign-in (last line of journey F07): see concern 8.

## Requirements
- R1. With no valid session, opening any address of the web app shows the sign-in page at `/login`. The page shows no channel name, no message and no member name (FR-03 AC-007, BR-01).
- R2. With a valid session, opening `/login` or any other address shows the app; the sign-in page is not shown (journey F04).
- R3. After a successful sign-in the person lands on the address they first opened; when there was none, on `/`. An address that is not a path of this web app is ignored and `/` is used.
- R4. The email step shows exactly: the logo and the workspace name, one email field, and the button 'Send code'. It has no password field (journey F04, FR-01 AC-002).
- R5. 'Send code' is disabled until the field holds a well-formed email address; pressing Enter in the field does nothing while it is disabled (D-104).
- R6. While a code request runs, 'Send code' is disabled, and a second press or a second Enter sends no second request (D-111).
- R7. When the server accepts the request, the screen changes to the 'Check your email' step. What is shown is identical for an address that is a member and one that is not (BR-04, journey F05 case 1).
- R8. The 'Check your email' step shows exactly: the logo and the workspace name, the heading 'Check your email', the address that was typed, one 6-digit field, the line 'The code works for 10 minutes', the link 'Use a different email' and the button 'Resend code' (journey F04, D-082, D-136).
- R9. The code field holds digits only and at most 6: typed letters and symbols do not appear, a 7th digit is not taken, and pasting 'ab12cd' leaves '12' (FR-01 AC-002, TS-003, TS-004).
- R10. When the field reaches 6 digits, by typing or by pasting, the code is sent once without any button press. With fewer than 6 digits nothing is sent, whatever key is pressed (journey F04, TS-003).
- R11. With the right code the app opens at the address of R3. No welcome screen or other step is shown in between (D-083).
- R12. 'Resend code' is disabled for 60 seconds after the latest code request for this address and enabled from the 60th second: at 59 seconds it cannot be pressed, at 60 it can (D-038, D-082, TS-009).
- R13. Pressing 'Resend code' asks for a new code. When the server accepts, the code field is emptied and enabled, any message under it is removed, and the 60 seconds of R12 start again.
- R14. 'Use a different email' returns to the email step with the earlier address in the field and selected. It sends no request.
- R15. Reloading the page on the 'Check your email' step shows that step again, with the same address and the remaining wait of R12, for up to 10 minutes after the latest code request. After that, a reload shows the email step.
- R16. Wrong code: the message 'That code is not right. 4 tries left.' shows under the code field, with the number the server gave. The field shakes slightly, is emptied and keeps the focus. The person stays on this step (journey F05 case 2, D-137, TS-002).
- R17. Locked code: after the 5th wrong try the message 'This code is locked. Ask for a new one.' shows under the code field, and the field is disabled until a new code has been requested (journey F05 case 3, D-137, TS-006).
- R18. Expired code: the message 'This code has expired' shows under the code field together with a button 'Send a new code'. Pressing it does what 'Resend code' does in R13 (journey F05 case 4, D-136, TS-005).
- R19. Too many requests: the message 'You have asked for too many codes. Try again in 12 minutes.' shows under the field of the step where the request was made, with the server's wait rounded up to whole minutes. The step does not change (journey F05 case 5, D-038, TS-007).
- R20. Deactivated account: after a correct code the message 'This account has been deactivated. Contact an admin.' shows under the code field. The app does not open (journey F05 case 6).
- R21. Network lost: when a request gets no answer from the server, the message 'Could not connect. Check your network and try again.' shows under the field of the current step, what was typed stays in the field, and the control that sent the request can be used again (journey F05 case 7).
- R22. Server failure: when the server answers with a failure (5xx), a message that includes the server's error ID shows under the field of the current step, and the control that sent the request can be used again (D-131). Its wording is not decided: concern 1.
- R23. Under a field there is at most one message at a time. A new answer replaces it; leaving the step removes it.
- R24. When the server refuses a request because the session is no longer valid while an app screen is showing, a modal with the text 'Your session has ended' and the button 'Sign in again' covers the app. Nothing behind it can be read, focused, clicked or reached by a screen reader, and neither Esc nor a click outside closes it (journey F07, D-075).
- R25. 'Sign in again' opens `/login` with the address that was showing as the return address of R3 and with the person's email filled in (journey F07).
- R26. When the refusal says the account was deactivated, the same modal says 'This account has been deactivated' and has no button (journey F07).
- R27. However many requests are refused, one modal is shown.
- R28. Every text of these screens is read from the `i18n` package and exists in English and Vietnamese; no component of this ticket holds a literal text, and the missing-translation check of TOKI-017 passes (D-018, D-064).
- R29. At 360 × 560, 719, 720, 1099 and 1100 px wide, each step and the modal show with nothing clipped, no sideways scrolling and every control reachable; under 720 px every control is at least 40 px tall (D-068, NFR-01, journey F38).
- R30. The whole flow can be done with the keyboard alone, and nothing in it needs hover (D-067, D-075). The focus is placed as "Keyboard and screen readers" says.
- R31. Each message under a field is tied to that field for screen readers and is announced when it appears; an invalid field is marked invalid.
- R32. The email address and the code never appear in the address bar, and the code is never written to browser storage.
- R33. When the device asks for reduced motion, the code field does not shake (R16); the message still shows.
- R34. Both steps and the modal are drawn only with the tokens and base components of the design system, and show correctly in Calm and in Focus (NFR-05).

## Design
Marked "Decided in this spec" where the Blueprint leaves the choice to the builder.

### Screens
1. **Email step** (`/login`, first step). A card centred on the page background. From top to bottom: the logo and the workspace name; the email field; the button 'Send code' as wide as the card. The look follows the prototype's guest sign-in card (`.gsign`, `.gcard`: card up to 420 px wide, 24 px padding, the workspace tile and name on top, `.inp` field, `.btn primary wide` button). The email field is focused when the step opens.
2. **'Check your email' step** (`/login`, second step). The same card. From top to bottom: the logo and the workspace name; the heading 'Check your email'; the address that was typed; the 6-digit field; the line 'The code works for 10 minutes'; under the field, the place for one message; the button 'Resend code'; the link 'Use a different email'. There is no button that sends the code (R10; see concern 6). The code field is focused when the step opens.
3. **'Your session has ended' modal.** The Modal of TOKI-014 over the app, at every width. Its backdrop is opaque, so the content behind is covered, not dimmed. Decided in this spec: opaque, because journey F07 says the content is covered and FR-46 TS-210 requires that no message can be read. It holds the text 'Your session has ended' and the button 'Sign in again'. In the deactivated form it holds only the text 'This account has been deactivated'.
4. **Checking the session.** While the app asks the server whether the browser has a session, the page shows the page background only: no card, no text and no app content. Decided in this spec: no text, so that no undecided wording is needed and the sign-in card does not flash before the app opens.

### States of the sign-in page
| State | Shown | Leaves when |
| :---- | :---- | :---- |
| Email, empty or malformed | 'Send code' disabled | The address becomes well-formed |
| Email, well-formed | 'Send code' enabled | Press or Enter |
| Email, request running | Field read-only, 'Send code' disabled | The server answers, or no answer comes |
| Code, waiting for digits | Field enabled; 'Resend code' disabled until 60 s have passed | 6th digit; 'Resend code'; 'Use a different email' |
| Code, check running | Field read-only; 'Resend code' and the link disabled | The server answers, or no answer comes |
| Code, wrong | R16 | Next 6th digit |
| Code, locked | R17 | A new code is requested |
| Code, expired | R18 | A new code is requested |
| Code, resend running | 'Resend code' and 'Send a new code' disabled | The server answers, or no answer comes |
| Signed in | The app at the return address | Not applicable |

### Texts
Decided texts, with their source. Key names are decided in this spec (namespaces `signIn` and `sessionEnded`).

| Key | English text | Source |
| :---- | :---- | :---- |
| `signIn.email.submit` | Send code | Journey F04 |
| `signIn.code.title` | Check your email | Journey F04, ticket TOKI-023 |
| `signIn.code.validity` | The code works for 10 minutes | Journey F04, D-136 |
| `signIn.code.changeEmail` | Use a different email | Journey F04, D-082 |
| `signIn.code.resend` | Resend code | D-082, journey F04 |
| `signIn.error.wrongCode` | That code is not right. {count} tries left. | Journey F05, D-137 |
| `signIn.error.locked` | This code is locked. Ask for a new one. | Journey F05, D-137 |
| `signIn.error.expired` | This code has expired | Journey F05, D-136 |
| `signIn.code.sendNew` | Send a new code | Journey F05 |
| `signIn.error.tooMany` | You have asked for too many codes. Try again in {minutes} minutes. | Journey F05, D-038 |
| `signIn.error.deactivated` | This account has been deactivated. Contact an admin. | Journey F05 |
| `signIn.error.network` | Could not connect. Check your network and try again. | Journey F05 |
| `sessionEnded.title` | Your session has ended | Journey F07 |
| `sessionEnded.signInAgain` | Sign in again | Journey F07 |
| `sessionEnded.deactivated` | This account has been deactivated | Journey F07 |

The journeys are the accepted baseline (D-091). The texts that no decision or journey gives are listed in concern 1 with a proposal each; the Vietnamese texts are concern 2. The workspace name and the address are data, not translated text.

### Errors
Every message shows under the field of the step, never in a toast (D-104).

- Address not in the workspace -> the 'Check your email' step as usual; nothing tells the cases apart (R7). No mail is sent; that is the server's part.
- Malformed address -> 'Send code' stays disabled (R5). Whether a message also shows, and its wording, is not decided: concern 1.
- Wrong code -> R16. The number comes from the server; the screen does not count tries itself.
- 5th wrong try -> R17. 'Resend code' stays under its 60-second wait; when it enables, the person asks for a new code.
- Code older than 10 minutes -> R18. The screen learns this from the server's answer when a code is sent; it runs no 10-minute timer of its own. Decided in this spec: the server is the only judge of expiry, so the screen and the server cannot disagree when clocks differ.
- 6th request in 15 minutes -> R19. On the email step the message is under the email field; after 'Resend code' or 'Send a new code' it is under the code field.
- Deactivated account -> R20. The code field is emptied and stays enabled; 'Use a different email' still works.
- No answer from the server -> R21. On the code step the 6 digits stay in the field; the person sends them again by pressing Enter or by changing the field back to 6 digits (see concern 6).
- Server failure (5xx) -> R22.
- Session refused while the app is showing -> R24; account deactivated while the app is showing -> R26.
- Session missing or older than 30 days when Toki is opened -> the sign-in page (R1), not the modal. The modal is only for a session that ends while an app screen is showing.
- The same address asks again inside 60 seconds (possible through 'Use a different email', or a second tab) -> not decided: concern 7.

### Layout at the three widths
The sign-in page has no sidebar, no tabs and no panels, so it is one centred card at every width. Calm and Focus differ here only in colours and type.

- Under 720 px (down to 360 × 560): the card fills the width with a 16 px margin on each side and sits in the upper part of the screen, so the on-screen keyboard does not cover the field or the message. Fields and buttons are at least 40 px tall. The code field opens the numeric keypad. With the keyboard closed, each step fits in 560 px of height without scrolling; with it open the page scrolls and the focused field stays in view.
- 720 to 1099 px, and from 1100 px: the card is 420 px wide, centred both ways. Nothing else changes between these two ranges.
- The modal of R24 is the centred Modal at every width; under 720 px it keeps a 12 px margin, as the prototype's modal does. Decided in this spec: Modal and not Sheet, because it has one action and must not look dismissible.

### Keyboard and screen readers
- Email step: focus starts in the email field. Tab order: field, 'Send code'. Enter in the field does what the button does when it is enabled.
- Code step: focus starts in the code field. Tab order: field, 'Send a new code' (only when shown), 'Resend code', 'Use a different email'. After a wrong code the focus stays in the emptied field (R16). After 'Resend code' succeeds the focus returns to the field. 'Use a different email' puts the focus in the email field.
- A disabled button is skipped by Tab and announced as unavailable.
- The code field is one text input with `inputmode="numeric"`, `autocomplete="one-time-code"` and a 6-character limit. Decided in this spec: one input instead of six boxes, because paste, autofill from the mail app and screen readers work without extra code. The email field uses `type="email"` and `autocomplete="email"`.
- A message is linked to its field with `aria-describedby`, the field carries `aria-invalid`, and the message sits in a live region so it is read out when it appears (R31).
- Modal: focus is trapped inside (D-075). It moves to 'Sign in again'; in the deactivated form, to the text itself. Esc does nothing. Focus is not returned to the app behind, because the app is covered until the person signs in again.
- No control in this ticket is icon-only.

### Routes and state
- **Path.** The sign-in page is `/login` (technical design). Decided in this spec: both steps are on `/login` and the step is not part of the address, because the code step means nothing without a code request and must not be reachable by typing an address.
- **Guard.** A check in the root route asks `client-core` for the session before any app route renders. No session -> `/login?next=<path>`; session and the path is `/login` -> `next` or `/`. Decided in this spec.
- **Return address.** `next` holds a path of this app only. It is used when it starts with one `/` and is not `/login`; otherwise `/` is used (R3). It never holds an email address.
- **Filled-in email.** `/login` accepts an address through the router's navigation state, not through the address bar (R32). It is used by 'Sign in again' (R25) and by TOKI-097 for a used invitation. Decided in this spec.
- **Session state.** `client-core` holds one session state: `unknown`, `signedOut`, `signedIn` (with the person), `ended` (reason `expired` or `deactivated`). The API client sets `ended` when the server refuses a request for a missing or ended session while the state is `signedIn`; the realtime connection, when it is built, calls the same function. The modal is shown from this state, once (R27). Decided in this spec.
- **Code step state.** The address, the time of the latest code request and the wait until 'Resend code' are kept for the tab through the storage interface of the `platform` package, so a reload or a phone that reloads the tab after the mail app does not lose the step (R15). The record is removed on sign-in, on 'Use a different email', and when it is older than 10 minutes. The code itself is never kept. Decided in this spec.
- **Waits.** The 60 seconds of R12 and the minutes of R19 use the wait the server gives in its answer when it gives one; otherwise 60 seconds counted from the answer. The countdown reads the time through one clock function, so tests can move it.
- **Language and look before sign-in.** The page shows the language and the look that the `i18n` and `tokens` packages report as active. This ticket adds no language switch and no look switch. English is the default (D-018). What is active before sign-in is concern 3.

### What the screens need from the Sign-in API
The names and shapes are fixed by the TOKI-022 spec (D-125). The screens need these outcomes to be told apart:

| Call | Outcomes the screen must be able to tell apart |
| :---- | :---- |
| Ask for a code (email) | Accepted (same for member and non-member; ideally with the seconds until a resend is allowed) · too many requests (with the seconds to wait) · malformed address · asked again too soon (concern 7) |
| Send a code (6 digits) | Signed in · wrong (with the tries left) · locked · expired · account deactivated |
| Read the current session | The person (at least id and email) · no session |
| Any other request | Refused because the session ended · refused because the account is deactivated |

### Layout
```
packages/client-core/src/auth/
├─ session-store.ts      the session state and markSessionEnded()
└─ sign-in.ts            requestCode(), submitCode(), readSession(); no DOM
packages/ui-web/src/sign-in/
├─ SignInCard.tsx        logo, workspace name, slot for a step
├─ EmailStep.tsx
├─ CodeStep.tsx          exported; TOKI-097 may reuse it
├─ CodeField.tsx         digits only, 6 at most, sends on the 6th
└─ SessionEndedModal.tsx
packages/i18n/           keys signIn.* and sessionEnded.* in en and vi
apps/web/src/routes/
├─ login.tsx             the /login route; reads next and the filled-in email
└─ __root.tsx            the guard; mounts SessionEndedModal
```
Storage is reached only through `platform`, and `client-core` touches no DOM (boundary rules of TOKI-002).

## Testing
- Unit tests (Vitest), written first: the code field (R9: letters, a 7th digit, pasting 'ab12cd', pasting '123 456'); sending once on the 6th digit (R10); the return address rule (R3: `/c/1`, `//other.example`, `https://other.example`, `/login`); the session state changes (R24, R26, R27); rounding the wait up to minutes (R19).
- Component tests with a faked API, one per row of "Errors": each asserts the text, that it sits under the right field, and the state of the field and buttons afterwards (R16 to R23). The 60-second rule is tested at 59 and 60 seconds with the controllable clock of TOKI-008 (R12).
- End-to-end tests (Playwright) against the real server and Mailpit: sign in as an active member by reading the code from the mail (R1, R4 to R11, TS-001); an address that is not a member reaches the same step and gets no mail (R7); five wrong codes then the right one (R16, R17, TS-006); a code entered just over 10 minutes after it was sent, by moving the clock (R18, TS-005); a 6th request (R19, TS-007); a deactivated member (R20); the network switched off before 'Send code' (R21); opening a deep address without a session and landing on it after sign-in (R1, R3, TS-011); reload on the code step (R15).
- Session ended: end the session on the server while a page is open, trigger a request, expect the modal, press Tab and Esc, then sign in again and land on the same address (R24, R25, R27). Repeat with a deactivated account (R26).
- Layout: each step, each message and the modal are opened at 360 × 560, 719, 720, 1099 and 1100 px, in Calm and Focus, in English and Vietnamese (R29, R34). Keyboard-only run of the whole flow (R30). An automated accessibility check on both steps and the modal (R31).
- R28 is checked by the missing-translation check of TOKI-017 and by a search of `packages/ui-web/src/sign-in` for literal texts. R32 is checked in the end-to-end test by reading the address bar and the browser storage after each step. R33 is checked with reduced motion emulated.
- Fake data only: addresses on `example.com`, accounts from the test seed. No real address and no real code in any test or fixture.

## Data safety
- The email address is never put in the address bar or in `next` (R32). It is kept for the tab only, for at most 10 minutes, and removed on sign-in.
- The code is held in the field only; it is never stored and never written to the console or to a log.
- The page never shows whether an address is a member (R7). The screen draws no conclusion of its own from timing or from the answer.
- `next` accepts paths of this app only, so a link cannot send a person to another site after sign-in (R3).
- The session itself is a cookie set by the server (technical design); this ticket reads and stores no session secret.
- When the modal of R24 shows, the content behind is not reachable. What happens to data cached in the browser when a different person then signs in belongs to the cache work in `client-core` (D-132); this ticket does not decide it.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I03 sign-in-by-email-code | Planning fact; Scope names the line with TOKI-021, 022, 026, 097 and 099. |
| Milestone M2; size M | Planning fact. Scope keeps the server, the mail and the invitation pages out. |
| Needs TOKI-014 and TOKI-022 | Modal from TOKI-014 (R24); the outcomes in "What the screens need from the Sign-in API". Other needs the plan does not list: concern 10. |
| Builds FR-01, FR-02, FR-03 on the screen side; follows FR-28 | FR-01: R4, R9 to R11, R16 to R18. FR-02: R12, R13, R19. FR-03: R1, R2. FR-28: R5, R23 and "Errors". |
| Agreed scope: email step, 'Check your email' step, 7 error cases, 'Your session has ended' | R4 to R8; R7 and R16 to R21 (the 7 cases); R24 to R27. |
| 6-digit emailed code, no password | R4 (no password field), R9, R10. |
| The mail carries the code only; nothing signs in without the code | The only way through the page is the code field (R10, R11); `/login` takes no sign-in link or token. |
| A code is valid for 10 minutes | The line 'The code works for 10 minutes' (R8); the expired case (R18). |
| 5th wrong try locks the code; the screen says how many tries are left | R16, R17. |
| At most 5 requests in 15 minutes; resend after 60 seconds; a new code cancels the earlier one | R19; R12; R13 (the field is emptied; cancelling is done by the server). |
| Same behaviour whether or not the address is a member | R7; Data safety. |
| A code signs in only the device that asked | Enforced by TOKI-022. The screen keeps the step on the device that asked (R15) and offers no way to enter a code without first asking for one (code step not reachable by address). |
| Errors under the field; button disabled until valid | R5, R16 to R23. For the code step, which has no button: concern 6. |
| A button is disabled while its request runs | R6; state table ("request running", "resend running"). |
| No welcome screen | R11. |
| With a session, straight to the app; without one, the sign-in page and no workspace content | R2; R1. |
| A session lasts 30 days and renews on every use | Enforced by TOKI-022. The screen shows the sign-in page when the server reports no session (R1) and the modal when it ends in use (R24). |
| 'Your session has ended', 'Sign in again', content covered, return to the open conversation; deactivated form without a button | R24, R25, R26. The draft in the composer: concern 8. |
| Texts are those of journeys F04, F05 and F07 | "Texts" table. Status of those texts under D-139: concern 5. |
| English by default, Vietnamese fully translated, every text through the translation package | R28. Vietnamese wording: concern 2. Language before sign-in: concern 3. |
| Smallest size 360 × 560; layout changes at 720 and 1100 px | R29; "Layout at the three widths". |
| Nothing hover-only or desktop-only | R30. Sending the code again on a touch keyboard: concern 6. |
| Icon-only buttons are named; a modal traps focus | No icon-only control; R24 and "Keyboard and screen readers". |
| Last two versions of Chrome, Edge, Safari and Firefox | Standard inputs and attributes only; the end-to-end tests are run on the browsers of NFR-14. |
| The sign-in page lives at `/login` | "Routes and state". |
| Member, Admin, Guest; no Owner | The screens are the same for Member and Admin and name no role. |

## Open questions from the intent
- Q1. Which small texts are missing? Not answered. The log decides none of them. Carried forward as concern 1, with a proposal for each.
- Q2. What are the Vietnamese texts? Not answered. D-188 is Open. Carried forward as concern 2.
- Q3. Which language and look before sign-in? Answered in part: English is the default (D-018). Whether a language or look remembered on the device is used is not decided. Carried forward as concern 3.
- Q4. Where does a signed-out page get the workspace name? Not answered. Carried forward as concern 4.
- Q5. D-139 or D-091 for the sign-in texts? Answered for this spec: D-091 is the later decision (13 Nov 2026) and accepts the phase-1 journeys as the baseline, so the texts of F04, F05 and F07 are used as written. The log does not say that D-139 is withdrawn. Carried forward as concern 5 for confirmation.
- Q6. A button on the code step? Not answered. Journey F04 lists none. Carried forward as concern 6.
- Q7. The same address asking again inside 60 seconds? Not answered. Carried forward as concern 7.
- Q8. The draft after signing in again? Answered for this spec: not built here; this ticket returns the person to the same address (R25). Carried forward as concern 8.
- Q9. Which work makes other tabs notice a sign-out? Not answered. Carried forward as concern 9.

## Areas of concern
1. Texts that no decision, requirement or journey gives. Each needs a wording before the build; the proposals are proposals only. (a) Label of the email field: proposal 'Email' (the prototype's guest card uses it). (b) Label of the code field for screen readers: proposal 'Code'. (c) Message for a malformed address, and whether it shows at all while 'Send code' is disabled: proposal 'Enter a valid email address', shown when the field loses focus. (d) Server failure (R22): proposal 'Something went wrong. Try again. (Error {id})'. (e) Text on or beside 'Resend code' while it waits: proposal 'Resend code in {seconds} s'; without a decision the button is simply disabled. (f) Confirmation after a resend: proposal 'We sent a new code.'; without a decision nothing is shown beyond the emptied field. (g) One try left and one minute left: the journeys give only '4 tries left' and '12 minutes'; proposal '1 try left' and '1 minute'. (h) Browser tab title: proposal 'Sign in · Toki'. Owner: Thanh Truong.
2. The Vietnamese texts of every key are not decided, and D-188 (form of address) is Open, yet the missing-translation check fails the build without them (D-064). Proposal: translate with 'bạn', as D-188 proposes, and review them with the English texts. Owner: Thanh Truong.
3. Language and look before sign-in. Both are saved to the account (D-175), which is unknown on a signed-out page. D-018 gives English as the default; nothing says whether the page follows the browser's language, a choice remembered on the device, or 'Match my device' for the look. This spec shows what `i18n` and `tokens` report as active and adds no switch. Proposal: the last language and look used on this device, else English and the default look. Owner: Thanh Truong.
4. The sign-in card shows the workspace name (journeys F01 and F04), but no ticket scope names a way for a signed-out page to read it, and BR-01 allows only the sign-in page to be public. Proposal: TOKI-022 adds one public answer that holds the workspace name only. Until it is decided R4 cannot be completed. Owner: Thanh Truong.
5. D-139 (Accepted Assumption) says every wording the prototype does not contain is a proposal and "the design decides the final words"; D-091 (Confirmed, 13 Nov 2026) accepts the phase-1 journeys as the baseline. This spec treats the texts of F04, F05 and F07 as decided. If D-139 still holds for them, the "Texts" table needs a sign-off. Owner: Thanh Truong.
6. The code step has no send button, as journey F04 describes ("it submits when complete"). Two effects: D-104 ("the button is disabled until the form is valid") has no button to apply to on this step; and after a network failure (R21) a person on a phone keypad that has no Enter key can send the same 6 digits again only by deleting and retyping one. Proposal: add a button 'Sign in', disabled until the field holds 6 digits, as on the prototype's guest card; its text is not decided. Owner: Thanh Truong.
7. Nothing decides what the email step shows when the same address asks again inside 60 seconds (through 'Use a different email' and back, or a second tab). The server allows a resend only after 60 seconds (TOKI-022). Proposal: go to the 'Check your email' step without sending a mail, with 'Resend code' waiting for the rest of the 60 seconds. Owner: Thanh Truong.
8. Journey F07 ends with "The draft being typed is still in the composer". This ticket returns the person to the same address (R25) but the composer and its drafts do not exist when it is built, and the page leaves the app to show `/login`. The draft must be kept by the drafts work (FR-38); that ticket should carry this case as a test. Owner: Thanh Truong.
9. D-093 requires the other tabs of a browser to be signed out at once. A tab that makes no request does not learn that the session ended, so the modal of R24 appears only at its next request. No ticket scope names the signal between tabs. This spec leaves it to TOKI-099 (Sign out), which can set the session state of this ticket to `signedOut` in every tab. Owner: Thanh Truong.
10. The plan lists only TOKI-014 and TOKI-022 as needs. The design also uses the router of TOKI-006, the `i18n` package of TOKI-017, the `platform` storage of TOKI-018 (reached through TOKI-012) and the Playwright harness and clock of TOKI-008. All are in M1, which ends before M2, so the order holds; the plan's needs list should name TOKI-006 and TOKI-017. Owner: Thanh Truong.
11. The table "What the screens need from the Sign-in API" is written before the TOKI-022 spec is merged. If that spec cannot tell two outcomes apart (for example locked and expired, or ended and deactivated), the matching requirement here (R17, R18, R26) cannot be built as written. The two specs must be compared before either is built. Owner: Thanh Truong.
12. `client-core` has no API client yet and no ticket in M1 owns it (noted in the web skeleton spec). This ticket adds only `auth/`; if TOKI-022 or another M2 ticket creates the shared API client first, `sign-in.ts` uses it instead of its own calls. Owner: Thanh Truong.
