# The platform package design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/platform-package.md (Thanh Truong)
Ticket: TOKI-018

## Goal
The builder (Thanh and Claude) needs one agreed way for components and client code to reach four features that each device offers differently: notifications, storage on the device, file picking and sound. The `platform` package is empty today, and lint forbids `ui-web` and `client-core` to call the browser for these, so nothing can use them yet.
After this change the package holds the interface and its web implementation, the web app selects that implementation, and lint stops `client-core` and the packages it imports from importing the web implementation.

## Scope
- In:
  - The `Platform` interface with four parts: `notifications`, `storage`, `files`, `sound`.
  - The functions `setPlatform` and `getPlatform`, through which every user reaches the implementation.
  - The web implementation, `createWebPlatform`, under `packages/platform/src/web/`.
  - One call in `apps/web/src/main.tsx` that selects the web implementation.
  - The hand-off from TOKI-002: the ban on importing the web implementation in boundary rule 1, its lint-rule tests, and rule 1 extended to the interface files of `platform`.
  - The same import ban in boundary rule 3, so lint, not only review, stops `ui-web` from importing `@toki/platform/web` (R28; concern 4).
  - Unit tests of the package, and the DOM test environment they need.
- Out (not now):
  - Push registration, the service worker, showing a system notification, the 'Turn on notifications' card and removing a registration on sign-out: TOKI-074. It adds its methods to the `notifications` part; the two methods of this work stay as they are.
  - The sound file, when a sound plays and the 'Play a sound' switch: TOKI-075 (the file and the call) and TOKI-073 (who gets a sound). This work ships no audio file.
  - The composer's attachments: the limits of 10 files and 100 MB, drag and drop, paste, upload and progress: TOKI-059. Drag and drop and paste read their files from DOM events in the component; opening the file dialog goes through `platform`, and so does sending the picked file to storage, which TOKI-059 adds as `files.upload` (Design, `handle`).
  - Writing text to the device clipboard (Copy text, Copy link): TOKI-052 adds it as a member `clipboard` with the method `writeText` (a write, no read), with its web implementation and tests, in its own change. `createWebPlatform()` then still starts nothing (R5): the method calls the browser only when it is called.
  - What each feature keeps on the device and under which key: the ticket that keeps it (the code step: TOKI-023; a waiting message and dropping it when someone else signs in: TOKI-040).
  - A store for more than text values (IndexedDB), and telling other tabs that something happened: not built. TOKI-040 adds the first to this package if a waiting message needs more than a text value; TOKI-099 adds the second as a fifth member of `Platform`, `tabs`, with its web implementation and its tests, in its own change. `createWebPlatform()` then still starts nothing (R5): that member opens its channel when it is first used.
  - Reading whether the device is light or dark for 'Match my device': TOKI-078. It is not one of the four features and lint does not ban it in `ui-web`.
  - The native implementation (phase 3) and the desktop implementation (phase 6).
  - An in-memory implementation for tests: tests of other packages use the web implementation in a DOM test environment, or pass their own object to `setPlatform`.
  - The other rules of TOKI-002, and CI (TOKI-007).
- Decided in this spec: rule 1 is extended to the interface files of `platform` (R24), because TOKI-002 concern 10 says which part of `platform` `client-core` may import is settled together with concern 9, and an import ban alone would not stop a browser API from being written into the interface entry. This changes these lines of the merged TOKI-002 spec, and the TOKI-018 change edits them in the same pull request: Design rule 1, last sentence ("`packages/platform` is not covered, see concerns 9 and 10"); R5 and R6, which name four packages (R6 also ends with the ban on the web implementation, concern 9); R15, whose allow-list sentence then covers five folders (its list of real paths no longer exists on `main`; the lint test of R24 takes its place); concern 10; the constraint-table row and the two answered review gaps that say `platform` "is handled when its web implementation is created". The alternative, to keep rule 1 to the ban on importing the web implementation, was rejected: the ban alone leaves the interface entry unchecked.

## Requirements
Interface and selection
- R1. `@toki/platform` exports the types `Platform`, `StorageArea`, `NotificationPermissionState`, `PickedFile` and `SoundName`, and the functions `setPlatform` and `getPlatform`. At the end of this ticket `Platform` has exactly four members, `notifications`, `storage`, `files` and `sound`, with exactly the methods listed in Design. Later tickets add methods (TOKI-074, TOKI-075, and TOKI-059, which adds `files.upload`) or a member (TOKI-099 adds `tabs`, the signal between the tabs of one browser; TOKI-052 adds `clipboard`) and update the test that checks this and any fake `Platform` that tests build.
- R2. `getPlatform()` called before any `setPlatform` throws an error whose message contains `setPlatform`. After `setPlatform(p)`, `getPlatform()` returns that same object `p`. A later `setPlatform(q)` replaces it.
- R3. `@toki/platform/web` exports `createWebPlatform(options?)`, and its result is assignable to `Platform` with no cast. `packages/platform/package.json` has exactly two `exports` entries: `.` (`./src/index.ts`) and `./web` (`./src/web/index.ts`).
- R4. Importing `@toki/platform` where no DOM exists (a test in the `node` environment) does not throw, and the files it loads use no browser global: they pass boundary rule 1 (R24).
- R5. Calling `createWebPlatform()` has no visible effect and starts nothing: it does not ask for the notification permission, writes nothing to browser storage, requests no audio file and adds no element to the document.

Storage
- R6. `storage.device` and `storage.tab` each have `get(key)`, `set(key, value)`, `remove(key)` and `clear()`. Keys and values are strings. After `set(k, v)` returns `true`, `get(k)` returns `v`; `get` of a key that was never set, or was removed, returns `null`.
- R7. `storage.device` keeps its values in the browser's `localStorage`: a value set there is read by a second `createWebPlatform()` in the same browser, in another tab and after the browser is closed and opened again. `storage.tab` keeps its values in `sessionStorage`: a value set there survives a reload of the tab and is not readable from another tab.
- R8. Every key is stored with the prefix `toki:` (the key `sign-in.step` is stored as `toki:sign-in.step`). `clear()` removes every key of that area that has the prefix and leaves every other key of the origin in place.
- R9. No storage method throws. When the browser refuses storage (reading the storage object throws, or a write goes over the quota), `get` returns `null`, `set` returns `false`, and `remove` and `clear` do nothing.

Notifications
- R10. `notifications.permission()` returns exactly one of `unsupported`, `default`, `granted`, `denied`. It returns `unsupported` when the browser has no `Notification` object (for example Safari on iPhone when Toki is not installed to the Home Screen, D-108); otherwise it returns the browser's own value.
- R11. `notifications.requestPermission()` asks the browser and resolves with the state after the person answered. At the end of this ticket it is the only method of this package that makes the browser show its permission prompt; TOKI-074 adds a method that can show it too (subscribing to push) and updates this sentence and its test.
- R12. `requestPermission()` never rejects. With no `Notification` object it resolves with `unsupported` and calls nothing; when the browser's request throws or rejects, it resolves with the value of `permission()`.

File picking
- R13. `files.pick(options?)` opens the browser's file dialog and resolves with the picked files in the browser's order, each as `{ name, size, mimeType, handle }`, where `size` is in bytes and `handle` is the browser's own `File` object. With `multiple: true` the person may pick several files; without it, at most one.
- R14. `options.accept` is a list of file type filters (for example `["image/*"]`) passed to the dialog. Without it the dialog offers every file type (D-095).
- R15. When the person closes the dialog without picking, `pick` resolves with an empty list. `pick` never rejects.
- R16. A call to `pick` while an earlier call is still waiting resolves the earlier call with an empty list. A single call that is not made from a press of the person may stay unanswered: the browser then opens no dialog and sends no event, and this package does not detect it. The caller opens the dialog only from a press.
- R17. `pick` checks no count and no size, and returns files of any size. Once a call has resolved, it has left no element in the document; a call that stays unanswered (R16) leaves its hidden input until the next call resolves it.

Sound
- R18. `sound.play("notification")` plays, once, the audio file whose address was given as `createWebPlatform({ sounds: { notification: <address> } })`, and resolves with `true` when the browser started playing it.
- R19. `play` never rejects and resolves with `false` when nothing was played: the browser blocks sound because the person has not yet interacted with the page, the file cannot be loaded, or no address was given for that name.
- R20. No audio file is requested before the first `play`. A `play` while the same sound is still playing starts it again from the beginning; two copies never play at the same time.

Lint (the hand-off from TOKI-002)
- R21. A source file in `packages/client-core`, `packages/shared`, `packages/i18n` or `packages/tokens` that imports `@toki/platform/web` or one of its subpaths, or a relative path that resolves into `packages/platform/src/web`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. "Source file" is a file under `src/` that the rule 1 block of `eslint.config.js` covers (not a test file). Checked by the lint test of R23.
- R22. A source file in those four packages that imports `@toki/platform` passes `pnpm lint`. Checked by the lint test of R23.
- R23. A lint-rule test, `tools/lint-rules/platform-boundary.test.mjs`, runs the real `eslint.config.js` with `ESLint.lintText` on made-up code placed at paths under the four packages, the way `icon-only-button-name.test.mjs` does for rule 4. It checks that an import of `@toki/platform/web`, of `@toki/platform/web/storage` and of a relative path into `packages/platform/src/web` is reported by `@typescript-eslint/no-restricted-imports` (the same rule that bans `@toki/ui-web`), that `import("@toki/platform/web")` is reported by `no-restricted-syntax`, and that an import of `@toki/platform` has no message. The test fails when the ban is removed from `eslint.config.js`. `pnpm test:lint-rules` and `pnpm test` run it; the file is added to both scripts in the root `package.json`.
- R24. Boundary rule 1 (the allow list of globals, the banned DOM type names and the banned imports, R21 included) also covers the source files of `packages/platform` outside `src/web/`. `packages/platform/src/web/**` is not covered by rule 1. The same test file lints made-up code at `packages/platform/src/index.ts` and at another path under `packages/platform/src/` outside `web/`: `localStorage`, `window` and an import of `@toki/platform/web` are reported there, a plain type and function pass; at `packages/platform/src/web/storage.ts` the same `localStorage` use gives no rule 1 message, and a test file such as `packages/platform/src/index.test.ts` is not covered. The test fails when the block stops covering the interface files or starts covering `src/web/`.

- R28. A source file in `packages/ui-web` (test files excepted) that imports `@toki/platform/web` or one of its subpaths, or a relative path that resolves into `packages/platform/src/web`, makes `pnpm lint` exit non-zero with an error that names the file and boundary rule 3; an import of `@toki/platform` passes. The same test file as R23 lints made-up code at a path under `packages/ui-web/src/`: each of the three import forms of R21 and `import("@toki/platform/web")` is reported, an import of `@toki/platform` is not, and a test file under `packages/ui-web/src` is not covered. The test fails when the ban is removed from the rule 3 block of `eslint.config.js`.

Package and wiring
- R25. `packages/platform/package.json` has no `dependencies` entry, and no file of the package imports `@toki/i18n` or holds a text shown to a person.
- R26. `apps/web/src/main.tsx` calls `setPlatform(createWebPlatform())` before the app is mounted, and `@toki/web` declares `@toki/platform` as a `workspace:*` dependency. Outside `packages/platform` and the lint-rule test files under `tools/lint-rules`, it is the only file that imports `@toki/platform/web`.
- R27. `pnpm typecheck`, `pnpm lint`, `pnpm test:lint-rules`, `pnpm format:check` and `pnpm test` exit 0 at the repository root with this work in place.

## Design
### The interface
`packages/platform/src/types.ts`:

```ts
export type StorageArea = {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  clear(): void;
};

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export type PickedFile = {
  name: string;
  size: number;
  mimeType: string;
  handle: unknown;
};

export type SoundName = "notification";

export type Platform = {
  notifications: {
    permission(): NotificationPermissionState;
    requestPermission(): Promise<NotificationPermissionState>;
  };
  storage: { device: StorageArea; tab: StorageArea };
  files: {
    pick(options?: { multiple?: boolean; accept?: string[] }): Promise<PickedFile[]>;
  };
  sound: { play(name: SoundName): Promise<boolean> };
};
```

Each choice below is decided in this spec; the Blueprint names the four features and leaves their shape to the builder.
- **One object, set once.** `apps/web` calls `setPlatform(createWebPlatform())` at start; components and `client-core` call `getPlatform()`. Reason: `ui-web` is also the interface of the desktop app (phase 6), which has its own build of `platform`, so a component must not name an implementation. A module-level holder needs no React, so `client-core` can use it too. Tests call `setPlatform` with the web implementation or with their own object.
- **Two entry points.** `@toki/platform` is the interface and the holder, with no browser API; `client-core` and the packages it imports may import it. `@toki/platform/web` is the web implementation; only `apps/web` imports it. This settles the part that concerns 9 and 10 of the TOKI-002 spec left open.
- **Storage is synchronous and holds text.** Reason: on the web a screen can read a value before its first paint (the code step after a reload, a collapsed group), with no flash of the wrong state. The caller turns its record into text. A key is named `<feature>.<name>` (for example `sign-in.step`); the ticket that keeps a value names its key. Unverified assumption: that a synchronous store exists for the phone build of phase 3. The technical design names no native storage and says nothing that needs a synchronous read, and no one has chosen the native store. The phone tickets of phase 3 inherit this as a constraint to check, not as a fact (concern 6). Tokens of the app's header session (technical design, two session kinds) are not kept in `storage.device` or `storage.tab`; they need their own secure store.
- **Two storage areas.** `device` is for values that must outlive the tab (a waiting message, D-132; the conversation last viewed; collapsed groups). `tab` is for values that must not be readable from another tab and end with the tab (the code step of the sign-in screens).
- **Storage never throws.** A browser can refuse storage (blocked site data, a full quota). The caller learns it from `set` returning `false` and carries on without the value; for the code step that means the step is lost on reload and the person starts again, which TOKI-023 must accept or handle.
- **`clear()` removes Toki's keys only**, by the `toki:` prefix, so other pages on the same origin keep their values.
- **`unsupported` is a permission state**, not an error, so a screen can explain it (iPhone before 'Add to Home Screen', D-108). It is one value for every browser without `Notification`, so it does not tell iPhone from another browser (journey F36 has a different text for each). Decided in this spec: this work adds no field. TOKI-074 chooses between detecting iPhone in `ui-web` (rule 3 does not ban `navigator.userAgent`) and adding a method to `notifications`; both are additions.
- **No method shows a notification.** A system notification appears only when the app is closed or the tab is hidden (journey F36), and that is done by the service worker of TOKI-074.
- **`handle` is `unknown` in the interface.** The interface files may name no DOM type (rule 1). The web implementation returns the browser's `File` there. `client-core` may not use `XMLHttpRequest`, `File`, `Blob` or `FormData` (TOKI-002 allow list), and only the platform that made a handle can read it, so the code that sends a picked file lives in `platform`: TOKI-059 adds `files.upload(handle, ticket, options?)`, which sends the file to the address of an upload ticket, reports progress and returns a result value (its web implementation sends one `XMLHttpRequest`, because `fetch` has no upload progress). It is an addition and changes nothing built here. The native build will put its own file reference in `handle` and have its own `upload`.
- **Sound by name.** A component asks for `"notification"`; the address of the file is given once, where the web implementation is created. This package holds no audio file, so it adds nothing to the initial JavaScript. Phase 1 has one sound name; a new name is added to `SoundName`.
- **Promises that never reject.** `requestPermission`, `pick` and `play` report every outcome as a value, so no caller needs a `catch` for an expected case.

### How the known later uses fit
| Use | Through |
| :---- | :---- |
| The sign-in code step survives a reload (TOKI-023) | `storage.tab`: `get`, `set`, `remove`; one text value under a key that ticket names, which the caller never fills with the code. Expiry is the caller's (`expiresInSeconds`). |
| A waiting message survives a reload and is dropped when someone else signs in (TOKI-040, D-132) | `storage.device`: `set`, `get`, `remove` |
| The conversation last viewed on this device, the list filter and collapsed groups (journeys; BR-08, TS-030 of the requirements; TOKI-033) | `storage.device`, one text value (JSON written by the caller) under a key the ticket names, for example `conversationList.filter` |
| Saved preferences (TOKI-078) | Look, accent, density and language are saved to the account (D-175), so it needs no per-device value except, possibly, a copy of the look to avoid a flash on load, which `storage.device` serves. It uses `notifications.permission()` (blocked state, F36) and `storage.device`, nothing more. 'Match my device' reads the system setting outside `platform` (Scope, Out). |
| Attachments picked in the composer (TOKI-059) | `files.pick({ multiple: true })`; the limits are applied by the composer; the upload and its progress go through `files.upload`, which TOKI-059 adds (Design, `handle`) |
| Copy text on a message (TOKI-052) and Copy link in the attachment window (TOKI-062) | `clipboard.writeText(text)`, a new member that TOKI-052 adds next to the others; nothing built here changes. It has no method that reads the clipboard. |
| 'Turn on' asks the browser; Preferences shows that notifications are blocked (TOKI-074, journey F36) | `notifications.requestPermission()`, `notifications.permission()` |
| Sign-out reaching the other tabs of the browser (TOKI-099) | A new member `tabs`, added by TOKI-099 next to the four; nothing built here changes. |
| Push registration and the service worker (TOKI-074) | Methods that TOKI-074 adds to `notifications` |
| A sound for a message in another conversation (TOKI-075) | `sound.play("notification")`; TOKI-075 passes the address of its file in `apps/web/src/main.tsx`. A message sound is not played from a press, so TOKI-075 may need to add a method that starts the sound on the first press (see Sound below). |

### The web implementation
- Storage: `localStorage` for `device` and `sessionStorage` for `tab`. Every access is inside a `try`, including reading the storage object itself, which can throw.
- Notifications: reads `Notification.permission` and calls `Notification.requestPermission()`. The browser shows its prompt only when the call comes from a press of the person; the caller is responsible for that (journey F36: only after 'Turn on').
- File picking: a hidden `<input type="file">` is created, added to the document, clicked, and removed when the call resolves. The `change` event gives the files; the `cancel` event gives the empty list. When the call does not come from a press, the browser opens no dialog and sends no event, so the call stays unanswered until a later `pick` resolves it (R16). `navigator.userActivation.isActive` could detect this case at once, but it is not checked here for all four browsers of D-108, so it is not relied on. The input's `click()` runs before the first `await` of `pick`, because a click after an `await` can lose the browser's permission to open the dialog. The `cancel` event of a file input is assumed to exist in the supported browsers; this is checked by hand (Testing).
- Sound: one `Audio` element per sound name, created on the first `play`. Its `play()` promise gives `true`; a refusal or a load error gives `false`. Safari is believed to let a call outside a press through only if the element was started earlier by a press (not verified here), so a lazily created element could be refused every time in Safari. Nothing here rules out TOKI-075 adding a method that unlocks the sound on the first press.
- The implementation uses only APIs present in the last two versions of Chrome, Edge, Safari and Firefox (D-108) and has no runtime dependency.

### Lint
In `eslint.config.js` (TOKI-002):
- The banned imports of rule 1 gain `@toki/platform/web`, its subpaths, and relative paths that resolve into `packages/platform/src/web` (R21), written the same way as the existing ban on `@toki/ui-web`.
- The `files` list of the rule 1 block gains the source files of `packages/platform`, with `src/web/**` and test files left out (R24).
- `tools/lint-rules/platform-boundary.test.mjs` is added with the cases of R21 to R24 and R28, and listed in the `test` and `test:lint-rules` scripts of the root `package.json`. It reads `eslint.config.js` as it is, so a ban removed from the configuration fails the test.
- Rule 3 gains the ban on `@toki/platform/web`, its subpaths and relative paths that resolve into `packages/platform/src/web`, written the same way as the ban of rule 1 (R28). `ui-web` still passes when it imports `@toki/platform`.
- When TOKI-059 adds `files.upload`, it adds `"XMLHttpRequest"` to `platformGlobals` of rule 3, so lint stops `ui-web` from sending a request itself, and one case to `tools/lint-rules/platform-boundary.test.mjs`: a use of `XMLHttpRequest` in a `ui-web` source is reported; one in `packages/platform/src/web/` is not, because rule 3 does not cover that package.

### Errors
- `getPlatform()` before `setPlatform` -> throws an error that names `setPlatform` (R2). This is a wiring mistake, not a case a person meets.
- Storage refused by the browser -> `get` gives `null`, `set` gives `false` (R9).
- No `Notification` object -> `unsupported` (R10, R12).
- File dialog closed -> empty list (R15). Dialog never opened because the call was not made from a press -> the call stays unanswered until the next `pick` (R16).
- Sound blocked, missing or not loadable -> `false` (R19).
- `client-core`, `shared`, `i18n` or `tokens` imports the web implementation -> lint error naming the file and the rule (R21).

### Layout
```
packages/platform/
├─ package.json         exports "." and "./web"; no dependencies; jsdom as a dev dependency
├─ tsconfig.json        DOM types available to this package
├─ vitest.config.ts     DOM test environment
└─ src/
   ├─ index.ts          re-exports types.ts and current.ts
   ├─ types.ts          the interface
   ├─ current.ts        setPlatform, getPlatform
   ├─ current.test.ts   runs in the node environment
   └─ web/
      ├─ index.ts       createWebPlatform
      ├─ storage.ts  notifications.ts  files.ts  sound.ts
      └─ storage.test.ts  notifications.test.ts  files.test.ts  sound.test.ts
apps/web/src/main.tsx   one added call (R26)
eslint.config.js        rule 1: banned import, files list
tools/lint-rules/    platform-boundary.test.mjs
```
- Decided in this spec: the DOM test environment is `jsdom`, pinned to an exact version as a dev dependency of `packages/platform`. If `ui-web` already pins `jsdom` when this is built (TOKI-012 R27 pins it there when `packages/platform` does not exist yet), this package uses that version, so the workspace holds one. The test harness (TOKI-008) leaves DOM tests out, and this is the first package that needs them.
- The package `tsconfig.json` makes the DOM types available (`lib` with `DOM`), as TOKI-001 leaves to the ticket that first needs them. As a result `pnpm typecheck` does not stop a DOM type from entering `types.ts` or `current.ts`. Only rule 1 does: it bans `Window`, `Document`, `Element`, `HTML*` and `SVG*` by name (TOKI-002 R5), and other DOM types (`File`, `Blob`) rely on the undefined-global check, which is unverified for type positions, and on review (TOKI-002 concern 12). Decided in this spec: no second `tsconfig` for `src/` outside `web/`; the cost is accepted for a package this small.

## Testing
- Tests are written first, with Vitest, and run by `pnpm test`. They use no real file, name or address. No test helper is exported (Scope, Out): a fake `Platform` written by hand in another package needs a new method or member each time TOKI-074, TOKI-075 or TOKI-099 adds one; that cost is accepted until a helper is needed in several files.
- R1, R3: a type-level test assigns `createWebPlatform()` to a `Platform` variable and names each exported type; `pnpm typecheck` fails when one is missing. The `exports` entries are read from `package.json` in a test.
- R2, R4: `current.test.ts` runs in the `node` environment: `getPlatform()` throws with `setPlatform` in the message; after `setPlatform(p)` it returns `p`; after `setPlatform(q)` it returns `q`. The import itself proves that no DOM is needed.
- R5: with recording fakes for `Notification`, `Audio`, `localStorage` and `sessionStorage`, `createWebPlatform()` is called and the test checks that no fake was called and the document has no new element.
- R6 to R8: set, get, remove and clear on both areas; the test reads `localStorage` and `sessionStorage` directly to check the area and the `toki:` prefix; a key without the prefix, written by the test, is still there after `clear()`; a second `createWebPlatform()` reads the value of the first.
- R9: the storage object is replaced by one that throws on read and by one that throws on `setItem`; each method is called and its return value checked.
- R10 to R12: the `Notification` object is removed, then replaced by a fake with each of the three browser values; `requestPermission` is checked for the answer, for a throwing fake and for a rejecting fake, and the fake's request count is 0 after every other call of the package.
- R13 to R17: the test finds the input the implementation added, sets its files to made-up `File` objects and sends `change`, or sends `cancel`; it checks the result, the `multiple` and `accept` attributes, that a 200 MB made-up size is returned unchanged, that the input is gone afterwards, that a second `pick` resolves the first with an empty list, and that a single call with no `change` or `cancel` stays unanswered and leaves its input (R16, R17); the test also checks that `click()` was called before the first `await`.
- R18 to R20: `Audio` is replaced by a fake whose `play()` resolves or rejects; the test checks `true` and `false`, the missing address, that no fake was created before the first `play`, and that a second `play` resets the position on the same fake.
- R21 to R24, R28: `pnpm test:lint-rules` runs `tools/lint-rules/platform-boundary.test.mjs` on the real `eslint.config.js` (cases in R23, R24, R28); `pnpm lint` also checks the real files on every run. Checked once by hand: remove the banned imports of rules 1 and 3 from `eslint.config.js` and confirm `pnpm test:lint-rules` fails and names the case; add `localStorage` to `packages/platform/src/index.ts` and confirm `pnpm lint` exits non-zero; then undo both.
- R25: a test reads `package.json` and fails on a `dependencies` entry; a search of `packages/platform/src` finds no import of `@toki/i18n`.
- R26: a search of the repository for `@toki/platform/web` finds `apps/web/src/main.tsx`, files under `packages/platform` and the lint-rule test files under `tools/lint-rules` only; the sample end-to-end test of TOKI-008 still passes, which shows the app mounts after the call.
- R28: the lint test of R28 (see R21 to R24 above); by hand, add `import "@toki/platform/web";` to a file under `packages/ui-web/src` and confirm `pnpm lint` exits non-zero and names rule 3's message; then undo.
- R27: the five commands are run at the root and their exit codes recorded in the PR.
- Checked once by hand in Chrome, Safari and Firefox, and recorded in the PR, because `jsdom` has no real dialog, prompt or sound: `pick` opens the dialog and returns the files; closing it returns an empty list; `requestPermission` from a button shows the prompt; `play` from a button with a test sound file is heard, and `play` before any interaction resolves with `false`; a `tab` value survives a reload and is absent in a new tab; a `device` value is still there after the browser is closed and opened again (R7); in Safari, `play` from a button is heard, and a second `play` made from a timer after that press is also heard (this shows whether an element created at the first `play` is accepted).

## Data safety
- The package sends nothing over the network and writes nothing to a log.
- Values kept through `storage` stay in the person's browser. What may be kept there is decided by the ticket that keeps it (the sign-in screens, for example, never keep the code).
- A picked file leaves the device only when the code that called `pick` uploads it (through `files.upload`, once TOKI-059 adds it).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I02 design-system, with TOKI-009 to TOKI-017, TOKI-093 and TOKI-094 | Planning fact; the package is what the base components build on. |
| Milestone: M1, Foundation and design system. Size: S, about half a working session with Claude | Scope: four small parts with no dependency; push, the sound file and attachments are left to their tickets (Scope, Out). |
| Needs: TOKI-001. Needed by: TOKI-012 and TOKI-013 | Builds in the `packages/platform` folder of TOKI-001; R1 and R2 give the base components their entry point. The other needs are concern 2 (answered). |
| Agreed scope: the interface for notifications, storage, file picking and sound; the web implementation. Its import ban is added to the boundary rules of TOKI-002 | R1 (interface), R3 and R5 to R20 (web implementation), R21 to R24 and R28 (import ban in rules 1 and 3). |
| `platform` holds the platform interface and the web and native implementations. Phase 1 has the web build only; the native build comes in phase 3 and the desktop build in phase 6 | Two entry points (R3); `setPlatform` lets each app choose its build (R2, R26). Only `src/web/` is built now. |
| Components reach platform features only through `platform`. `client-core` touches no DOM or browser API, so React Native can reuse it | `getPlatform()` is the one way in (R2); the interface entry uses no browser API and is checked by rule 1 (R4, R24). |
| TOKI-002 leaves two things to this ticket: the ban on importing the web implementation of `platform` in boundary rule 1, with a lint-rule test, and which part of `platform` `client-core` may import | R21 and R23 (ban and lint-rule test); R22 and R24 (`client-core` may import `@toki/platform`, which rule 1 covers). |
| The service worker is used for push only, and Web Push belongs to TOKI-074 | Scope, Out: no service worker and no push registration here; the `notifications` part has two methods (R10 to R12). |
| The browser asks for the notification permission only after the person presses 'Turn on' | R5 and R11: only `requestPermission()` makes the browser ask, and nothing calls it by itself. |
| Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Push on iPhone works only when Toki is installed to the Home Screen | The web implementation uses APIs of those versions only (Design); `unsupported` covers iPhone before installation (R10). The check on real browsers is concern 5 (accepted as a manual check). |
| Notification preferences belong to the person and apply on every device; only the browser's permission for push is per device. Look, accent, density and language are saved to the account | `permission()` reads the per-device permission (R10). Storage here is for per-device values only; no preference is kept in it by this work. |
| A 'Waiting to send' message is kept in the browser across a reload and is dropped when someone else signs in on that browser | `storage.device` keeps a value across a reload and `remove` drops it (R6, R7). TOKI-040 decides when. |
| A message carries up to 10 files, each up to 100 MB, and every file type is accepted | `pick` offers every type by default and applies no limit (R14, R17); the composer applies the limits (TOKI-059). |
| Phase 1 has sound | `sound.play` (R18 to R20). The file is concern 1: decided to leave it to TOKI-075. |
| The initial JavaScript of the web app stays under 200 KB compressed | No dependency and no audio file in the package (R25, R20). |
| English is the default interface language and every text goes through i18n | The package shows no text (R25); results are values that a screen turns into text. |

## Open questions from the intent
- Which sound does Toki play? Answered: decided with TOKI-075, which adds the file and passes its address; this work uses a made-up address (concern 1).
- Does this work also wait for TOKI-002, TOKI-006 and TOKI-008? Answered: yes, it edits the lint configuration of TOKI-002 and `main.tsx` of TOKI-006 and runs its tests on the harness of TOKI-008; all are in M1. The plan's needs list is concern 2.
- Which values does Toki keep per device? Answered for this work: the package needs no list. It keeps any text value under any key, and each ticket that keeps a value names its key as `<feature>.<name>` (Design).

## Areas of concern
1. No decision names the sound, and the prototype plays none (it has only the 'Play a sound' switch). This work can be built and tested without it, with a made-up address. Proposal, not a decision: one short sound, chosen with TOKI-075, which adds the file and passes its address. Owner: Thanh Truong. Decided by Thanh Truong (lead, as product owner) on 2026-11-18: the sound is chosen with TOKI-075, which adds the file and passes its address; TOKI-018 builds and tests with a made-up address.
2. The plan lists only TOKI-001 as a need. The design also needs TOKI-002 (the configuration and lint-rule tests it edits), TOKI-006 (`apps/web/src/main.tsx`) and TOKI-008 (Vitest and `pnpm test`). All are in M1, so the order holds, but the plan's needs list should name them. Owner: Thanh Truong. Answered: the needs list of TOKI-018 is TOKI-001, TOKI-002, TOKI-006 and TOKI-008, as the design requires; all four are in M1, so the order holds. Evidence: this spec, Scope and Open questions from the intent.
3. TOKI-002 handed over the import ban and the question of which part of `platform` `client-core` may import. Decided in this spec (Scope, last bullet of In/Out): `client-core` may import `@toki/platform` only, and rule 1 is extended to the interface files of `platform` (R24), with the list of TOKI-002 lines this changes. Owner: Thanh Truong.
4. Lint does not stop `ui-web` from importing `@toki/platform/web`; R26 is kept by review and by the search in Testing. The desktop app reuses `ui-web`, so one such import would defeat the purpose of the package, and the fix should not wait long. Proposal, not a decision: add that import to boundary rule 3, a one-line change. It is not done here because TOKI-002 handed over rule 1 only. Owner: Thanh Truong. Decided by Thanh Truong (lead, as product owner) on 2026-11-18: the ban is added to boundary rule 3 in this ticket (R28, Lint, Scope), so lint enforces R26 for `ui-web`. Note found while answering: TOKI-002 later dropped `tools/lint-fixtures` and the `pnpm lint:boundaries` script (commit bd91a77); this spec is revised so that R21 to R24, R27, R28, Lint and Testing rest on `eslint.config.js` and a lint-rule test in `tools/lint-rules` (`pnpm test:lint-rules`, `pnpm lint`), so the drift is fixed here. Settled.
5. The dialog, the permission prompt and blocked sound cannot be exercised in `jsdom`; they are checked by hand in three browsers. No ticket sets up the eight browser versions of NFR-14. Owner: Thanh Truong. Accepted by Thanh Truong (lead, as product owner) on 2026-11-18: the dialog, the prompt and blocked sound are checked by hand in Chrome, Safari and Firefox and recorded in the PR; setting up the eight browser versions of NFR-14 is out of scope for this ticket.
6. Storage is synchronous (Design). The only evidence is the web need of a read before first paint; nothing in the technical design says a synchronous store exists on the phone. Unverified assumption: an MMKV-style store through JSI would serve, which needs a development build rather than Expo Go. The alternative, an interface that loads its values into memory at start-up and then reads them synchronously, keeps synchronous reads on the web and does not bind the phone, but it makes start-up wait for the load and needs an `init` step. It is not chosen here because phase 3 has not picked a store and the web build gains nothing from it. If phase 3 finds no synchronous store, it changes `StorageArea` by adding that step, which touches every caller of the web build, so phase 3 planning should check it early. No one has decided the native store. Owner: Thanh Truong. Accepted by Thanh Truong (lead, as product owner) on 2026-11-18: `StorageArea` stays synchronous. Phase 3 planning checks early for a synchronous native store; if none exists, `StorageArea` gains an `init` step then.
