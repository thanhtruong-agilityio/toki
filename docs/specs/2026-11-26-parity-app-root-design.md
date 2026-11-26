# Parity check: pages outside the app shell design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/parity-app-root.md (Thanh Truong)
Ticket: TOKI-137

## Goal
The builder needs the UI parity check to take the picture of a page that is not inside the shell of the signed-in app, and the sign-in page is the first. Today the check takes the picture of `.app` on both sides; `.app` exists only in the shell, so the sign-in page cannot be checked. After this change a declared screen can name the element of the app that is captured, and the email step and the code step of the sign-in page are declared screens with reference images made from the prototype.

## Scope
- In: an optional field of the screen declaration that names the element of the app that is captured (R1, R2); the two sign-in screens (R3); their reference images (R4); the record of their differences (R5); the notes in the README (R6).
- Out (not now):
  - Fixing the differences that the check finds on the sign-in page: that is another ticket (the sign-in card, TOKI-136).
  - Any change to the prototype side of the check: it keeps capturing `#app` (concern 1).
  - Screens that need the seeded database, a real server, or a signed-in session.
  - The comparison and the picture of the difference.

## Requirements
- R1. A screen declaration (`ScreenDecl` in `e2e/support/parity.ts`) has an optional string `appRoot`, a CSS selector of the element that the check captures on the side of the app. Without it the element is `.app`, as today. A function `appRootOf(decl)` gives the selector. Check: a unit test in `e2e/support/parity.test.ts`: `appRootOf` of a declaration with `appRoot: "#root"` is `#root`, and of one without it is `.app`.
- R2. `e2e/parity/screens.spec.ts` captures `appRootOf(decl)` on the app side. The prototype side is not changed (concern 1). The screens declared today (`admin`) give the same rows and the same ratios as before. Check: a run of the check lists the `admin` rows with the same ratios as on `main`.
- R3. `e2e/parity/screens/signin.ts` declares two screens: `signin-email` (the email step) and `signin-code` (the code step). Both have `section: "guest"` (the prototype opens its guest sign-in card at the hash `#guest`), `appRoute: "/login"` and `appRoot: "#root"`. Their `setup` stubs the calls of `/api/v1/auth/` with the helpers of `e2e/support/sign-in.ts`: the workspace name `Hugepig Studio` (the name on the prototype's card) and a code that is accepted. The address typed is the fake `linh@saigoncoffee.example`, the one the prototype's card holds. `signin-code` goes through the email step with the steps of the declaration and waits for the code field, so that the picture is of the code step (a step that clicks the code field does this). Check: a run lists the 12 rows (2 screens, 2 looks, 3 widths) and none fails for a missing element.
- R4. The reference images of the two screens, 12 files `e2e/parity/reference/signin-<email|code>-<calm|focus>-<wide|mid|narrow>-chromium-linux.png`, are made by `pnpm ui:reference signin-email signin-code` from the prototype, and are in the pull request. Check: the files are there and a run of the check does not fail with "no reference".
- R5. The differences of the 12 rows that are above the limit are listed in `e2e/parity/known-differences.ts`, one entry for each row, with the ticket `TOKI-136` (the sign-in card) and a reason that says two things: the sign-in card is fixed by that ticket, and the picture of the prototype is of `#app`, so it also holds the rounded frame, the link 'Back to the normal view' and, in the code step, the purple note 'Prototype: no email is sent', which the app has not (concerns 3 and 4). A run then lists them as `known` and not as new. Check: a run lists no new difference for these rows.
- R6. `e2e/parity/README.md` says what `appRoot` is and when to use it (a page outside the shell), that `section` is a key of the prototype's HASH or `guest`, and gives the sign-in declaration as the example. Check: the file holds them.
- R7. `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and the check gives the same rows in two runs one after the other (no flaky wait). Check: the commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request) and two runs of the check are recorded in the pull request.

## Design
`captureElement(page, selector, mask)` already takes the selector. The two places that call it:
- the app side, `screens.spec.ts`, which passes `".app"` today and passes `appRootOf(decl)` after this change;
- the prototype side, `captureReference` in `parity.ts`, which passes `"#app"` and does not change.

The sign-in page is drawn into `#root` (`apps/web/index.html`); the card is `.gsign` inside it and the page has no `.app`. On the prototype the guest card is inside `#app`, so the two pictures are of the whole window of each side (concern 4).

```ts
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
  ready: ".gcard",
  appSteps: [
    { fill: ['input[type="email"]', EMAIL] },
    { click: "text=Send code" },
    { click: ".inp.code" }, // waits for the code field
  ],
  setup,
};
```

### Layout
```
e2e/support/parity.ts            appRoot, appRootOf
e2e/support/parity.test.ts       test of appRootOf
e2e/parity/screens.spec.ts       captures appRootOf(decl)
e2e/parity/screens/signin.ts     the two screens
e2e/parity/reference/            12 new images
e2e/parity/known-differences.ts  the entries of R5
e2e/parity/README.md             R6
```

## Testing
- `appRootOf` is written first and seen to fail, in `e2e/support/parity.test.ts`.
- The check is run in the container: the `admin` rows keep their ratios (R2), the 12 rows of the sign-in page appear (R3), and the run is repeated once to see that the rows are the same (R7). The two runs are recorded in the pull request.
- Data used is fake only: the `example` and `.example` addresses and the made-up code of the stubs.

## Data safety
- The pictures hold only the prototype's invented data and the stubbed data of the check; no real address or secret goes into the repository.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The screens that are declared today produce the same pictures and the same rows as before | R1 (the default is `.app`), R2 |
| The reference images are made from the prototype, never from the app | R4 (`pnpm ui:reference`) |
| The check stays inside the Playwright container and uses fake data only | R3 (stubs and fake address), Testing |

## Open questions from the intent
- Is the element captured named for the app side only, or for both sides? Answered: for the app side only. The prototype side always captures `#app` (`captureReference` in `e2e/support/parity.ts`), and the prototype's guest card is inside it. See concern 1.
- How many widths and looks do the sign-in screens run in? Answered: both looks at the three widths, as the check does by default (12 rows). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.
- Does the check list the differences of the sign-in screens as new, or are they recorded as known until the sign-in card is fixed by its own ticket? Answered: recorded as known, with the ticket of the sign-in card (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 3.

## Areas of concern
1. The side of the prototype. Decided in this spec from the code: the prototype capture stays `#app`; a field for it would add a second option to every declaration and the sign-in page needs none. Answered: the element is named for the app side only. Owner: Thanh Truong.
2. The looks and widths of the sign-in screens. The default is both looks at the three widths (12 rows, and 12 reference images, about 356 KB in all). A smaller set would leave a case of the card untested. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: both looks at the three widths. Owner: Thanh Truong.
3. The differences of the sign-in rows. The 12 rows differ today (ratios 0.03 to 0.17 against 0.02). They can be listed as `known` with the ticket of the sign-in card (R5), so that a run stays free of new differences; or left as new, so that every run lists them until the card is fixed. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: listed as `known` with the ticket TOKI-136 (R5); when that ticket is done the report lists them as 'no longer a difference' and the entries go. Owner: Thanh Truong.
4. What the two pictures hold. The picture of the prototype is of `#app`, which has a rounded frame, the link 'Back to the normal view' and, in the code step, a purple note 'Prototype: no email is sent'; the picture of the app is of `#root` and has none of them. Part of the ratio of every row is therefore not the card. A reference that is of the card only would need a second option. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: accepted, with no second option; the reason of each known entry says so (R5). Owner: Thanh Truong.
