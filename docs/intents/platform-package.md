# Intent: The platform package
Author: Thanh Truong

## Problem
The `platform` package exists but is empty (TOKI-001). Toki needs four features that every device offers in its own way: notifications, storage on the device, file picking and sound.
The components are not allowed to call the browser for these directly: lint bans the notification, storage, service worker and audio APIs in `ui-web` (TOKI-002), and `client-core` may touch no browser API at all. Until `platform` has content, no component and no client code can keep a value on the device, ask for the notification permission, open the file dialog or play a sound.
If each screen solved this alone, the phone app (phase 3) and the desktop app (phase 6) would have to change every screen. The agreed design gives each of them its own build of `platform` and leaves the screens unchanged.
The lint rules also have a gap that only this work can close: the import path of the web build of `platform` was not known when the rules were written, so nothing stops `client-core` from importing it.

## Proposed outcome
There is one agreed way to reach the four features, and it works in the web app:
- keep a small value on this device or in this tab and read it back later;
- read whether the person allowed notifications, and ask the browser for that permission;
- let the person pick one or several files;
- play a sound.

The base components (TOKI-012, TOKI-013) and every later screen use it and never call the browser for these features directly.
Later work can add what it needs (Web Push, the sound file, the composer's attachments, values kept per device) without changing what earlier screens already use.
Lint blocks `client-core`, and the packages it imports, from importing the web build of `platform`.

## Affected users and systems
- Users: the builder (Thanh and Claude); indirectly every Member, Admin and Guest, who meet these features through later screens. Source: Toki Blueprint, intent I02 design-system.
- Systems: the `platform` package; the web app, which chooses the web build; the lint configuration and its fixtures (TOKI-002).
- Used by: the base components (TOKI-012, TOKI-013) directly. Known later uses: the sign-in screens keep the code step across a reload (TOKI-023); the sync engine keeps a waiting message across a reload (TOKI-040); attachments in the composer (TOKI-059); Web Push (TOKI-074); sound (TOKI-075).

## Constraints
- Belongs to Blueprint intent I02 design-system, with TOKI-009 to TOKI-017, TOKI-093 and TOKI-094. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Size: S, about half a working session with Claude. Source: Toki Blueprint, ticket TOKI-018.
- Needs: TOKI-001. Needed by: TOKI-012 and TOKI-013. Source: Toki Blueprint, ticket dependencies.
- Agreed scope: the interface for notifications, storage, file picking and sound; the web implementation. Its import ban is added to the boundary rules of TOKI-002. Source: Toki Blueprint, ticket TOKI-018.
- `platform` holds the platform interface and the web and native implementations. Phase 1 has the web build only; the native build comes in phase 3 and the desktop build in phase 6. Source: Toki Blueprint, technical design, code structure; D-024, D-026.
- Components reach platform features only through `platform`. `client-core` touches no DOM or browser API, so React Native can reuse it. Source: Toki Blueprint, technical design, boundary rules.
- TOKI-002 leaves two things to this ticket: the ban on importing the web implementation of `platform` in boundary rule 1, with a fixture line, and which part of `platform` `client-core` may import. Source: lint-format-boundary-rules spec, R6, concerns 9 and 10.
- The service worker is used for push only, and Web Push belongs to TOKI-074. Source: D-030; Toki Blueprint, ticket TOKI-074.
- The browser asks for the notification permission only after the person presses 'Turn on'. Source: journey F36, D-091.
- Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Push on iPhone works only when Toki is installed to the Home Screen. Source: D-108, NFR-14.
- Notification preferences belong to the person and apply on every device; only the browser's permission for push is per device. Look, accent, density and language are saved to the account. Source: D-142, D-175.
- A 'Waiting to send' message is kept in the browser across a reload and is dropped when someone else signs in on that browser. Source: D-132.
- A message carries up to 10 files, each up to 100 MB, and every file type is accepted. Source: D-042, D-014, D-095.
- Phase 1 has sound. Source: D-016.
- The initial JavaScript of the web app stays under 200 KB compressed. Source: NFR-13, D-113.
- English is the default interface language and every text goes through i18n. Source: D-018.

## Open questions
1. Which sound does Toki play? The prototype plays no sound and holds no sound file, and no decision names one.
2. The plan lists only TOKI-001 as a need. Does this work also wait for the lint rules (TOKI-002), the web skeleton (TOKI-006) and the test harness (TOKI-008), which it edits or uses?
3. Which values does Toki keep per device? The decision log names some (D-132; the conversation last viewed and the collapsed groups in the journeys) but gives no list.
