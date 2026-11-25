# Sound and in-app notifications design

Date: 2026-11-25 · Status: draft for review (concerns 1, 2, 5 and 9 are open for the product owner)
Intent: docs/intents/sound-in-app-notifications.md (Thanh Truong)
Ticket: TOKI-075

## Goal
A person who has Toki open and is reading one conversation must hear and see that something arrived in another one, without the app announcing what they already read, and must be able to open it with one press. The notification decision engine (TOKI-073) decides who is notified and hands each open screen a notice; the screen's notice centre judges whether it shows now, waits or is dropped, and whether its sound plays, and then calls a port named `sink` with two methods, `toast(notice)` and `sound(notice)`. This ticket builds that sink in the web app: the toast that the person sees, the sound file and its playing, and the step that lets Safari and the other browsers play a sound that code starts.
The toast component and its region already exist (TOKI-013, mounted by the shell, TOKI-015), and so do `platform.sound.play` and the web implementation (TOKI-018). What is missing is the content of each toast, the action of its button, the sound file, the way the sound is allowed, and the glue between the notice centre and these parts.

## Scope
- In:
  - The sound file made for Toki, its address and the check of its shape (R1, R2).
  - The sound feature of the platform: a new `unlock` method and the handling of an element that the browser refused (R3, R4).
  - The step that calls `unlock` on the first press or key, and arms it again after a refusal (R5).
  - The sink: the sound with its burst guard, the toast through a host, and the hand-over to the notice centre of TOKI-073 (R6, R7).
  - The host component and what each toast shows and does: text, button, where it stands, how long it lives, how it stacks (R8 to R12).
  - The texts, in English and Vietnamese (R13).
  - Nothing else changes, and the checks in real browsers (R14, R15).
- Out (not now):
  - Who is notified, with which switch, and what is on the screen: TOKI-073 (the server's decision and the screen's judgement). This ticket applies no second filter: a notice that reaches the sink is shown.
  - The switches 'Play a sound' and 'Desktop notifications', their storage, their default and their screen: TOKI-102 and TOKI-078. This ticket never reads a switch; the notice carries `sound` already decided.
  - A test sound played when a person turns the switch on, and a message that tells the person the browser blocks the sound: not in the prototype and in no decision; if the product owner wants either, the screen that holds the switch (TOKI-078) is the place, and concern 9 asks the question.
  - The system notification, the permission and the card that offers them: TOKI-074. The Activity list, its badge and its label 'Back from snooze': TOKI-066. The tab title with the unread count: TOKI-054.
  - The toast of a reminder (Later's own host, TOKI-067) and the summary toast at the end of Pause or Focus time (TOKI-076, which owns the count and the words): they use the same toast component and do not pass through this sink (concern 10).
  - The toast component, its timers, its cap and its place: TOKI-013 and TOKI-015. This ticket gives it content and sets no duration.

## Requirements
The sound file
- R1. The file `apps/web/assets/sounds/notification.wav` holds the one sound of Toki: two short soft notes, 880 Hz then 1318.51 Hz (A5 then E6), 120 ms each with a fast attack and an exponential fall, 0.4 s in all, peak at 0.25 of full scale (about -12 dBFS), 16-bit mono PCM at 22,050 Hz, so about 17.7 KB. It is made by `apps/web/scripts/make-notification-sound.mjs`, a Node script with no dependency that writes the same bytes on every run; the script's header says that the sound is made for Toki and holds no third-party material, so no licence file is needed. `apps/web/src/main.tsx` imports the file with the `?url` suffix and calls `createWebPlatform({ sounds: { notification: url } })`, replacing the call that TOKI-018 left without an address. Check: a test reads the file and parses its RIFF header: format PCM, one channel, 22,050 Hz, 16 bits, a duration from 0.3 to 0.6 s, a size under 40,000 bytes, and a peak sample between 0.2 and 0.3 of full scale; a second test runs the script into a temporary folder and compares its bytes with the file; the web build (`pnpm --filter ./apps/web build`) is followed by a check that `dist` holds the file as a separate asset and that no built JavaScript file contains `data:audio`; a test of `main.tsx`'s platform call finds the address under the name `notification`.
- R2. The file is requested by no code before the first `unlock` or `play` (TOKI-018 R20 stays true: `createWebPlatform` requests nothing). It is not preloaded by a `<link>` and it is not part of the JavaScript. Check: a test with a recording fake `Audio` calls `createWebPlatform({ sounds })`, then renders no screen and presses nothing, and sees no `Audio` created; the built `index.html` has no `rel="preload"` for the file.

The platform
- R3. `Platform["sound"]` gains `unlock(): Promise<boolean>`. `unlock` never rejects. For each sound name that has an address it creates the one `Audio` element of that name when there is none (the same element that `play` uses), sets its `volume` to 0, calls `play()`, and, when `play()` resolves, calls `pause()`, sets `currentTime` to 0 and `volume` back to 1; then the name is marked unlocked. It resolves `true` when every name with an address is unlocked (also when called again, with no further `play()` on an element that is unlocked), and `false` when a name has no address, when `Audio` does not exist, or when `play()` is refused. When `play()` is refused for any reason the volume goes back to 1 and the name stays locked. `unlock` must be called inside a press or a key handler to have effect (R5); the method itself checks nothing about that. TOKI-018 R1 says later tickets add methods; the types test and every hand-written fake `Platform` in the repository gain `unlock`. Check, with a fake `Audio` whose `play()` resolves or rejects as the test says: `true` after a resolved `play()`, with the order `volume = 0`, `play`, `pause`, `currentTime = 0`, `volume = 1` recorded on the fake; a second `unlock` makes no second `play()`; a rejected `play()` gives `false`, restores the volume and a later `unlock` tries again; a missing address gives `false`; `Audio` undefined gives `false`; the call never rejects; the types test lists the new method.
- R4. `play` and the element. `play("notification")` uses the element that `unlock` made, so an element that a press unlocked is the one that code later plays (Safari treats an element, not the page, as allowed). A `play` called while an `unlock` is running waits for it to end and then plays, so a notice that arrives at that moment does not play at volume 0. A refusal by the browser's policy (the rejection's `name` is `NotAllowedError`) resolves `false`, keeps the element and marks the name locked again, so that the next press can unlock the same element. Any other rejection (the file cannot be loaded) resolves `false` and drops the element, as TOKI-018 R19 and its code do now. The other rules of TOKI-018 R18 to R20 stay: `play` never rejects, a `play` while the sound plays starts it again from the beginning, and two copies never play at once. Check, with the fake `Audio`: an element created by `unlock` is the same object that `play` uses (one `Audio` constructed in all); a `play` started during a pending `unlock` calls the fake's `play` after the unlock's `pause`; a `NotAllowedError` keeps the element and marks it locked, a `NetworkError` drops it and the next call builds a new one; `play` after a lock resolves `false` and, after a new `unlock`, `true`; the TOKI-018 sound tests still pass.

The unlock step
- R5. `armSoundUnlock({ target, sound })` in `apps/web/src/notifications/sound-unlock.ts` adds capturing listeners for `click`, `keydown` and `touchend` to `target` (the document) and returns `{ rearm(), disarm() }`. The first of those events calls `sound.unlock()` at once, in the same call stack as the event, with no `await` before it, so the press that caused the event is the press the browser sees. When `unlock()` resolves `true` the listeners are removed; when it resolves `false` they stay, and the next event tries again. `rearm()` adds the listeners when they are not there (it adds none twice); `disarm()` removes them. The step is armed once, in `apps/web/src/main.tsx`, right after `setPlatform`, before the first render, so that the first press on any screen, the sign-in screens included, counts. It reads no switch: the cost of unlocking for a person whose switch is off is one request of the 17.7 KB file after the first press, and it lets a press on the switch itself unlock the sound in the same gesture (Design, "The unlock flow"). Nothing is shown and nothing is stored. Check, with a fake target that records `addEventListener` options and a fake `sound`: three listeners in the capture phase; the first `click` calls `unlock` once and, with the fake resolving `true`, removes all three; with `false` the next `keydown` calls it again; `rearm` after removal adds three and a second `rearm` adds none; `disarm` removes them; the call to `unlock` happens before the handler returns (the test reads the call count inside the handler, with no await); a test of `main.tsx` finds the step armed before the render.

The sink
- R6. `createNoticeSink({ platform, clock, openHost })` in `apps/web/src/notifications/sink.ts` returns `{ sink, attachHost, rearm }` and is the `sink` that TOKI-073 R18 asks for. It replaces the stand-in that does nothing: `apps/web/src/client.ts` (the file TOKI-073 R19 changes) builds the sink and passes `sink` to `createNoticeCenter`, and `main.tsx` passes the function returned by `armSoundUnlock` as `rearm`. `sink.sound(notice)` plays the sound with this guard: when fewer than `SOUND_MIN_GAP_MS` (1,000, Decided in this spec, concern 6) have passed since the last sound it started, it does nothing; otherwise it records `clock.now()` and calls `platform.sound.play("notification")`, and when that resolves `false` it calls `rearm()`. A call to `sound` never throws and never waits for the promise. The sink reads no switch, no preference and no notice field except to pass it on: the centre already called it only for a notice whose `sound` is true and that is not being read. Check, with the clock of TOKI-008 and a fake platform: a first call plays; a second call 999 ms later does not, a third 1,000 ms after the first does; a `false` from `play` calls `rearm` once; a `true` does not; a rejected promise from a broken fake is caught and nothing escapes; no `setTimeout` and no `Date.now(` occur in the file.
- R7. `sink.toast(notice)` passes the notice to the host that is attached (R8) and does nothing when none is attached, which is the case on every screen that has no shell (sign-in, Join) and after sign-out. `attachHost(host | null)` replaces the host and returns nothing; the host is `{ show(notice): void }`. A notice that arrives with no host is not kept: the notice centre keeps the notices that wait (TOKI-073 R18), and a second queue here would show a toast twice. Check: a notice with no host calls nothing and throws nothing; with a host it is passed once and unchanged; a second `attachHost(null)` after a host stops the calls.

The toast
- R8. `NoticeHost` (`apps/web/src/notifications/NoticeHost.tsx`) is a component that draws nothing. It is rendered once, as a child of the `AppShell` in `apps/web/src/routes/app-layout.tsx`, so that it sits inside the `ToastProvider` that the shell mounts (TOKI-015 R23) and inside the `JumpProvider` of TOKI-068 R14. On mount it calls `attachHost` with a host whose `show` builds the toast of R9 and calls `useToasts().show` (TOKI-013); on unmount it calls `attachHost(null)` and dismisses the toasts it showed that are still on the screen, so a person who signs out or changes does not keep a toast of the earlier session. It reads the conversation store and the people of the signed-in person through `apps/web/src/notifications/deps.ts`, the one file of the folder that imports `client.ts` and the jump hook (TOKI-032 R25, TOKI-068 R13). Check: a render test finds the host attached after mount and detached after unmount; a toast shown by the host is gone from the region after unmount; the folder imports `client.ts` and `conversation/jump` only in `deps.ts`; `pnpm lint:boundaries` passes.
- R9. What each toast shows. The text is built by `noticeToast(notice, lookup, t)` in `apps/web/src/notifications/notice-text.ts`, a pure function of the notice, a lookup of people and conversations, and the translate function. `name` is the `displayName` of `notice.actorId` in the people of the store, or the text of `notifications.toast.someone` when there is no actor or the person is not known. `conversation` is the label of `notice.conversationId`: for a channel `notifications.toast.conversationChannel` with the name (that gives `#name`), for a direct message or a group `conversationName` of client-core (the other people's names), and `notifications.toast.conversationUnknown` when the store does not hold the conversation. `preview` is `notice.preview` with every run of white space (a newline included) replaced by one space and trimmed; the server cut it at 60 characters (TOKI-073 R1) and this ticket cuts nothing more and adds no ellipsis (the prototype's snippet has none). The text for each kind:
  | Notice | Text key | English | Source |
  |---|---|---|---|
  | `message` | `notifications.toast.message` | "{name} replied in {conversation}" | the prototype's toast for a message in another conversation ("Mai replied in #general"; the prototype writes the first name, the real data has the display name only, TOKI-032 R17) |
  | `mention`, `viaChannel` false | `notifications.toast.mention`, or `mentionNoText` when `preview` is empty | "{name} mentioned you in {conversation}: {preview}", or without the colon and the preview | F13 gives the sense and the first 60 characters; the words are a proposal, D-139 (concern 2) |
  | `mention`, `viaChannel` true | `notifications.toast.mentionChannel`, or `mentionChannelNoText` | "{name} mentioned the channel in {conversation}: {preview}" | F13 ("mentioned the channel"); a proposal (concern 2) |
  | `back_from_snooze` with an actor and a preview | `notifications.toast.backFromSnooze` | "Back from snooze: {name} {preview}" | the prototype ("Back from snooze: Minh …"), concern 7 |
  | `back_from_snooze` otherwise | `notifications.toast.backFromSnoozeBare` | "Back from snooze" | the prototype's prefix |
  The `message` toast shows no preview, as the prototype's toast shows none; this ticket does not use the `preview` that TOKI-073 R7 puts in a `message` notice for the toast. Check: a table test of `noticeToast` over every row above for a channel, a direct message and a group, with an unknown actor, an unknown conversation, an empty preview and a preview with a newline and double spaces; the English and Vietnamese results come from the keys of R13; the function reads no clock and no global.
- R10. What the button does. Each toast has one button with the text of `notifications.toast.view` ("View", the prototype's label) and no other action; pressing the body of the toast does nothing (the prototype and F13 name the button only). The press first closes the toast (the component's rule, TOKI-013 R24) and then: for `message` and `mention`, calls the `open` of `useOpenMessage()` (TOKI-068 R1) with `{ conversationId, messageId, parentId }` taken from the notice, so a reply opens the thread panel of its root and a message sent also to the channel, which has a `parentId`, is passed as the reply it is; when `messageId` or `conversationId` is null it navigates to `/c/{conversationId}` when there is a conversation and does nothing when there is none; for `back_from_snooze`, navigates to `/activity` (the prototype goes to the Activity section; the route is TOKI-066 R1). The toast never marks anything read: reading follows from the message being on screen (TOKI-053). Check, with a fake `open` and a fake navigate: a mention passes the three fields; a reply passes its `parentId`; a notice with `messageId` null navigates to the conversation; `back_from_snooze` navigates to `/activity`; pressing the body calls neither; after the press the toast is gone and `open` was called once.
- R11. Where it stands, how long it lives, how it stacks. All three come from the toast component and this ticket changes none of them; the requirement is that the host uses the component in the way that makes them true. The toast is added with `useToasts().show({ text, action })` with an `action`, so it lives 5 seconds (`TOAST_MS_WITH_ACTION`, F13 and the prototype's 5.2 s with a button; the timer stops while the pointer is over the toast or focus is inside it, TOKI-013 R23); the region is the bottom centre of the main area, above the bottom bar and above a composer that registered itself, never over them (D-078, F38; TOKI-013 R27 to R31); at most 3 toasts show at once, the newest at the bottom, and a fourth removes the oldest without calling its button (TOKI-013 R25); the region is the live region `aria-live="polite"`, so a screen reader reads each toast when it is added; a toast shown while a dialog is open stays above it (TOKI-014 R34). The host passes no class, no style and no duration. Check, with the real `ToastProvider` and the fake timers of the test runner: a notice toast is in the region at once, is there at 4,999 ms and gone at 5,000 ms; with the pointer over it at 5,000 ms it stays and goes 5,000 ms after the pointer leaves; four notices in a row leave three toasts, in the order of arrival; the region has `aria-live="polite"`; a search of the folder finds no `style` prop and no class name on a toast. The look and place at 360 and 1100 px are checked in the browser (R14).
- R12. One toast for each notice. The host makes one toast for each call of `show`, and two notices of one conversation make two toasts, with no merging and no replacing (concern 6). A toast is never made for a notice that the centre did not pass on: the host itself applies no rule of level, mute, switch, Pause, Focus or screen. Check: two `show` calls of notices of one conversation give two toasts; the folder has no import of the preferences, the level or the view state.

Texts and the rest
- R13. Texts. The namespace `notifications` of `@toki/i18n` (TOKI-102 R14 adds it with its first key; whichever of the two tickets is built second adds its keys to the file the first wrote and says so in its pull request) gains the keys of "Texts" below, each in English and in Vietnamese. Every text of the toast comes from them: `notice-text.ts` and `NoticeHost.tsx` hold no string literal that a person reads, and `ui-web` gains no text. The Vietnamese words are drafts that TOKI-080 reviews. Check: the i18n test that every key exists in every language passes; a test renders each key with its placeholders in both languages; a search of the folder `apps/web/src/notifications/` finds no quoted English word of the table.
- R14. Checked in real browsers, and recorded in the pull request (jsdom plays no sound and has no layout). In Chrome, Firefox, Safari on a Mac and Safari on an iPhone, with the web app opened in the browser and, on the iPhone, also installed to the Home Screen: (a) after a reload and with no press, a sound that code starts is refused (no sound, nothing shown); (b) after one press anywhere the same sound plays when the next notice arrives, also from a timer started after the press and also with Toki in a hidden tab; (c) a burst of five notices in one second plays one sound; (d) with 'Play a sound' off, or in Pause, no sound; (e) at 360 px and at 1100 px a toast stands above the bottom bar and above the composer and covers neither; (f) View opens the message and, for a reply, the thread. If (b) fails in Safari, the unlock method of R3 is changed inside `packages/platform` to use a Web Audio context resumed in the same press (the one place, concern 4) and nothing else changes. Check: the pull request lists each of (a) to (f) with the browser and the result.
- R15. Nothing else changes. No server code, no route, no event kind, no change to the bootstrap, no change to `NoticeData` or to the notice centre, no preference, no switch and no preference screen, no Activity item, no push. The edits to files of other tickets are small and the pull request names them: `packages/platform/src/types.ts` and `web/sound.ts` with their tests and fakes (R3, R4), `apps/web/src/main.tsx` (R1, R5), `apps/web/src/client.ts` (R6), `apps/web/src/routes/app-layout.tsx` (R8) and the namespace file of `@toki/i18n` (R13). Check: the pull request lists them; a search of `apps/server` and `packages/shared` in the diff finds nothing; a search of `packages/client-core` in the diff finds nothing.

## Design
### Where each part stands
```
server  --notification.created (user event)--> sync engine --> notice centre (TOKI-073)
                                                                 |  judges: show / wait / drop, sound yes / no
                                                                 v
                                                           sink (this ticket)
                                       .toast(notice) ---> NoticeHost --> useToasts().show --> toast region
                                       .sound(notice) ---> burst guard --> platform.sound.play("notification")
                                                                                 ^
 first press / key anywhere --> armSoundUnlock --> platform.sound.unlock() ------+  (same Audio element)
```
The centre is in `packages/client-core` and knows no component and no sound; the sink is in `apps/web` and knows both. The host is a component only because the toast API (`useToasts`) and the open-message hook (`useOpenMessage`) exist only inside React; the sink, which is built outside React in `client.ts`, reaches them through the attached host.

### What a toast shows and does
| Question | Answer | Where it comes from |
|---|---|---|
| Where | Bottom centre of the main area (the whole width on a phone), above the bottom bar and above a composer; never over them | the toast region (TOKI-013 R27 to R31), D-078, F38 |
| How long | 5 seconds, because it has a button; the timer pauses under the pointer and with focus inside | F13, prototype, TOKI-013 R23 |
| How many | Up to 3 stacked, newest at the bottom; a fourth pushes the oldest out | TOKI-013 R25 |
| What it says | The sender, the conversation and, for a mention, the first 60 characters of the message (R9) | F13, D-044 for the push (same content), prototype |
| What a press does | The button View opens the message, or Activity for a snoozed item that came back (R10); the body does nothing | F13, prototype |
| When it does not appear | When the centre does not pass it on: the person's level, Mute, Pause or Focus, the conversation or thread being on screen, an old notice (TOKI-073 R2, R17) | TOKI-073 |
| When it appears late | When the window was not in use the centre kept the notice and passes it when the person returns (TOKI-073 R18); the toast then lives its own 5 seconds | TOKI-073 |

### The sound
- Which sound. One file, `notification.wav`, two soft notes of 0.4 s in all (R1). The prototype plays no sound and no decision names one; the platform spec (TOKI-018 concern 1) left the choice to this ticket and the product owner accepted that (2026-11-18), so the choice is made here (concern 3). The name `notification` is the only member of `SoundName`; a second sound would add a name and a file.
- Where the file lives and how it is shipped. `apps/web/assets/sounds/`, beside `assets/fonts/`. The file is above the 4 KB limit under which Vite writes an asset into the JavaScript, so the build makes it a separate hashed file and `main.tsx` gets its address from the `?url` import; the check of R1 proves it. It is not in the service worker (TOKI-074 uses one for push only, D-030) and not preloaded (R2).
- When it plays. A sound plays for a notice only when all of these hold: the server decided `sound` true (the person's switch 'Play a sound' is on, the level and Mute allow it, and Pause or Focus time does not hold it: TOKI-073 R2); the screen judged that the person is not already reading it (not in the conversation at the bottom with the window in use, and not in the open thread: TOKI-073 R17); the burst guard lets it through (R6); and the browser allows it (R3 to R5).
- When it is blocked, by who:
  | Reason | Who stops it | What happens |
  |---|---|---|
  | 'Play a sound' is off (also on another device, the switch is the person's, D-142) | the server: the notice has `sound` false (TOKI-073 R2, TS-199) | no call to the sink |
  | Pause or Focus time | the server holds the notice: no event at all (D-072, TOKI-073 R2, R10) | nothing arrives; badges still update |
  | Level 'Nothing', Mute (a mention still passes while its switch is on) | the server: not allowed (D-103, D-088) | nothing arrives |
  | The window is in use and the message is on screen at the bottom, or the thread is open | the screen: `sound` false (TOKI-073 R17) | no call to the sink |
  | A second sound within 1 second | the sink (R6) | no sound; the toast still shows |
  | The browser refuses: the page has had no press, or Safari has not played this element from a press | the platform: `play` resolves `false` (R4) | no sound, nothing shown, the unlock step is armed again (R6, R5) |
  | The file cannot be loaded | the platform: `play` resolves `false` and drops the element | no sound; the next press unlocks a new element |
- A sound with the window not in use (a hidden tab) is allowed by the table of TOKI-073 and plays when the browser lets it (R14 (b) checks it).

### The unlock flow
1. The app starts. `main.tsx` sets the platform with the address of the file (R1) and arms the unlock step (R5). Nothing is requested and nothing is played.
2. The person presses a key or a button anywhere, for example the first button of the sign-in screen, the Send button or the switch 'Play a sound' itself. The step calls `platform.sound.unlock()` in that same event (R5).
3. `unlock` creates the element for `notification`, silences it (`volume` 0), plays it, and as soon as the play promise resolves pauses it, rewinds it and restores the volume (R3). The browser has now seen a press start this element, so it allows this element to be started by code later (the behaviour Safari documents for media elements; concern 4 says how sure we are). The step removes its listeners.
4. Later a notice arrives, the centre calls `sink.sound`, and `play` restarts the same element at full volume (R4). Nothing the person did is needed.
5. If the browser refuses a later play (an iPhone that discarded the page's permission, a tab restored from the background), `play` resolves `false`, the sink arms the step again (R6) and the next press repeats step 2 and 3. That refused sound is lost; the toast, the badge and the Activity item are not.
On iOS, `volume` cannot be changed by script, so the silent play in step 3 can be heard as a very short tick; it happens once for each page load (concern 4, R14).
Because the step is armed from the start, the person who turns on 'Play a sound' on another device and then opens this one is covered by their first press here, with no setting to find. A person whose switch is off pays one request of the file after the first press (R5).

### Why a sink and a host, and not the centre drawing toasts
`useToasts` and `useOpenMessage` are React hooks, so a function outside a component cannot call them. The alternative, making the centre a React component, would put the waiting list and its timers inside the render tree of one screen. The sink port that TOKI-073 R18 defines is the seam; the host is the part that has a React context (R8).

### Layout
```
packages/platform/src/
├─ types.ts                      sound.unlock (R3)
└─ web/sound.ts                  unlock, shared element, NotAllowedError rule (R3, R4)
apps/web/
├─ assets/sounds/notification.wav
├─ scripts/make-notification-sound.mjs
└─ src/
   ├─ main.tsx                   address of the file, armSoundUnlock (R1, R5)
   ├─ client.ts                  createNoticeSink, passed to the notice centre (R6)
   ├─ routes/app-layout.tsx      <NoticeHost /> inside the shell (R8)
   └─ notifications/
      ├─ sink.ts                 createNoticeSink (R6, R7)
      ├─ sound-unlock.ts         armSoundUnlock (R5)
      ├─ NoticeHost.tsx          the host (R8, R10, R11, R12)
      ├─ notice-text.ts          noticeToast (R9)
      └─ deps.ts                 client.ts, useOpenMessage
packages/i18n/src/messages/{en,vi}/notifications.ts    the keys (R13)
apps/web/tests/notifications/ and packages/platform/tests/web/sound.test.ts
e2e/notice-toast.spec.ts
```

### Texts
Namespace `notifications`, group `toast`. The English of `message`, `view` and the prefix of `backFromSnooze` come from the prototype; the rest are proposals under D-139 (concern 2).
| Key | English | Vietnamese (draft) |
|---|---|---|
| `notifications.toast.view` | View | Xem |
| `notifications.toast.message` | {name} replied in {conversation} | {name} đã trả lời trong {conversation} |
| `notifications.toast.mention` | {name} mentioned you in {conversation}: {preview} | {name} đã nhắc đến bạn trong {conversation}: {preview} |
| `notifications.toast.mentionNoText` | {name} mentioned you in {conversation} | {name} đã nhắc đến bạn trong {conversation} |
| `notifications.toast.mentionChannel` | {name} mentioned the channel in {conversation}: {preview} | {name} đã nhắc đến cả kênh trong {conversation}: {preview} |
| `notifications.toast.mentionChannelNoText` | {name} mentioned the channel in {conversation} | {name} đã nhắc đến cả kênh trong {conversation} |
| `notifications.toast.backFromSnooze` | Back from snooze: {name} {preview} | Đã hết hoãn: {name} {preview} |
| `notifications.toast.backFromSnoozeBare` | Back from snooze | Đã hết hoãn |
| `notifications.toast.conversationChannel` | #{name} | #{name} |
| `notifications.toast.conversationUnknown` | a conversation | một cuộc trò chuyện |
| `notifications.toast.someone` | Someone | Ai đó |
A direct message or a group uses the names from `conversationName` as they are, so it has no key.

### Errors
- A sound that the browser refuses, or a file that cannot be loaded: `play` resolves `false`, the unlock step is armed again, and nothing is shown or logged.
- A notice that arrives when no host is attached: dropped by the sink (R7).
- A notice that names a conversation or a person the store does not hold: the toast uses the texts for an unknown conversation and for "Someone" (R9).
- A bad notice never reaches the sink: the centre ignores it (TOKI-073 R18).

### Lines with the neighbouring tickets
| Ticket | Line | Where |
|---|---|---|
| TOKI-073 | Decides and sends the notice, judges it on the screen, owns the notice centre and the port `sink`; this ticket implements the port and applies no second rule | R6, R7, R12 |
| TOKI-102, TOKI-078 | Store and draw the switches; the sound's value arrives in `notice.sound`; this ticket reads no switch | R6, Out |
| TOKI-068 | The hook `useOpenMessage()` that the View button calls | R10 |
| TOKI-066 | Owns the Activity page, its badge and the label 'Back from snooze'; the toast's button goes to `/activity` | R10 |
| TOKI-074 | Web Push draws the system notification and has its own text and click; the sound here is the app's | Out |
| TOKI-076, TOKI-067 | Draw the summary toast and the reminder toast with the toast component, not through this sink | concern 10 |
| TOKI-018, TOKI-013, TOKI-015 | The sound feature, the toast and its place, and the shell; this ticket adds `unlock` and uses the rest as they are | R3, R4, R11 |
| TOKI-054 | The tab title with the unread count (the table row "tab hidden") is its | Out |

### Plan changes
Requests for the owners of other specs; this spec edits none of them.
- TOKI-073 R7: a `back_from_snooze` notice carries `actorId` (the actor of the Activity item) and a `preview` (the first characters of its text) when the item has them; today `preview` is null for that kind (R9 here, concern 7). TOKI-073 R17: a notice older than `NOTICE_TOAST_MAX_AGE_MS` plays no sound (concern 5). The line "the summary toast is TOKI-076's and TOKI-075's" in the table of fifteen situations (row 11) becomes "TOKI-076's" (concern 10).
- TOKI-018 R1 and R18 to R20: `Platform["sound"]` gains `unlock` and the element rule of R4 (R3, R4 here); the made-up address of its tests stays.
- TOKI-102 R14: the namespace `notifications` is shared with the toast keys (R13).
- Plan: the needs line of TOKI-075 stays TOKI-068, TOKI-073; the Safari unlock and the sound file are this ticket's, as the plan says.

## Testing
- Written test first. Platform tests in `packages/platform/tests/web/sound.test.ts` with a fake `Audio` (R3, R4, R2). App tests in `apps/web/tests/notifications/` with Vitest and Testing Library: `sound-unlock.test.ts` with a fake target (R5), `sink.test.ts` with the clock of TOKI-008 and a fake platform (R6, R7), `notice-text.test.ts` as a table (R9), `NoticeHost.test.tsx` with the real `ToastProvider`, a fake `open`, a fake navigate and the fake timers of the test runner (R8, R10 to R12). No test waits on a real timer. Fake people only (Sam, Mai, Minh, Lan).
- R1: the RIFF header test, the script-reproduces-the-file test and the build check (`dist` has the file, no `data:audio` in the JavaScript). R13: the i18n completeness test and a render of each key in both languages.
- R3 and R4 with the three outcomes of `play()` (resolves, `NotAllowedError`, another error). R5 with the order of the call and the handler's return. R11 with 4,999 and 5,000 ms, the pointer, and four toasts.
- R15: the pull request lists the edited files; a search of the diff.
- One browser test, `e2e/notice-toast.spec.ts`, in Chromium with `routeWebSocket` and `page.route` stubs as TOKI-041 R25 does, and `HTMLMediaElement.prototype.play` replaced by a recording function in an init script (headless Chromium plays no sound): a pushed `notification.created` event for a message in another conversation gives a toast with the sender and the conversation; View opens the conversation at the message; a second event 500 ms later makes a second toast and no second sound call; the first press unlocks (one `play` call with `volume` 0, then `pause`) and a later notice calls `play` once; at 360 px and 1100 px the toast does not overlap the composer or the bottom bar.
- Not tested here, by design: the decision and the screen judgement (TOKI-073), the switch (TOKI-102, TOKI-078), the system notification (TOKI-074), a real sound, and the browser's own refusal, which jsdom and headless Chromium do not give; R14 checks those by hand in four browsers and the result goes in the pull request.

## Data safety
- A toast shows the sender, the conversation and the start of a message on the person's own screen only, from a notice that is meant for that person (TOKI-073, data safety). The text is kept in memory for the life of the toast; nothing is stored in the browser and nothing is logged by this ticket (no `console` call in the folder, checked by lint).
- The sound file holds no personal data and no third-party material (R1). The step that unlocks the sound stores nothing, reads no text a person types and sends no request but the file's.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| A toast names the sender, the conversation and the start of the message (60 characters), has a View button and closes after 5 seconds (F13, prototype) | R9 (content), R10 (button), R11 (5 seconds from the component); the 60 characters are cut by the server (TOKI-073 R1) |
| Toasts and floating bars never cover the composer or the navigation (D-078, F38) | R11 (the region of TOKI-013 and TOKI-015), checked in the browser test and R14 (e) |
| A sound plays only when 'Play a sound' is on; level, Pause, Focus and Mute stop it (D-016, D-103, D-072, D-088) | the server's decision in `notice.sound` (TOKI-073 R2); R6 plays only on a call from the centre; the table "When it is blocked" |
| No toast or sound for what the person is reading (F36, the table) | the centre's judgement (TOKI-073 R17); R12 (the host applies no second rule) |
| The Safari sound unlock belongs to this ticket (plan, TOKI-018) | R3, R4, R5, the unlock flow, R14 (b) |
| The sound file is chosen with this ticket, which passes its address (TOKI-018 concern 1) | R1, concern 3 |
| The switches belong to the person and apply on every device (D-142) | R6 reads no switch; the value comes with each notice (TOKI-073, TS-199) |
| Last two versions of Chrome, Edge, Safari and Firefox (D-108) | R3 uses `Audio` and `play()` as those versions have them; R14 checks Chrome, Firefox and Safari (Edge shares Chrome's engine) |
| Every text through i18n, English by default, no text in `ui-web` (D-139, TOKI-023) | R13, R9 |
| Timers in tests use the controllable clock (TOKI-008) | R6 takes `clock`; R11 and the other timer tests use fake timers; Testing |
| M5, size S, needs TOKI-068 and TOKI-073 | R6 and R7 implement the port of TOKI-073 R18; R10 calls the hook of TOKI-068 R1 |

## Open questions from the intent
- What does a toast show and do: where, how long, how it stacks, what a press does? Answered: "What a toast shows and does" in Design, R9 to R12 (F13, the prototype, the toast component).
- Which sound does Toki play, and where does the file live? Answered: one made-for-Toki WAV at `apps/web/assets/sounds/notification.wav` (R1, concern 3).
- What is the default of 'Play a sound' for a new account? Not answered. Carried forward as concern 1. This ticket works with either default.
- What are the final words of each toast? Not answered. Carried forward as concern 2.
- How is the browser's block on sound lifted, in Safari in particular? Answered: R3 to R5 and the unlock flow (concern 4).
- Does a notice that waited a long time, or that is replayed after a lost connection, still play a sound? Not answered. Carried forward as concern 5.
- Does a snoozed item that came back show its sender and text in the toast? Answered: when the notice carries them (R9, concern 7).
- Should the person be told when the browser blocks the sound? Not answered. Carried forward as concern 9.
- Who draws the toast of a reminder and the summary toast at the end of Pause or Focus time? Answered: Later and TOKI-076 (concern 10).

## Areas of concern
1. The default of 'Play a sound'. Not decided. D-176 asks what 'Desktop notifications' and 'Play a sound' are for a new account and is Open; its text after the arrow ("as the prototype starts: Desktop notifications on, Play a sound off") is only a proposal. The prototype's initial state has the sound off. This ticket changes nothing with the answer: the unlock step runs whatever the default is (R5) and the sink plays only what the centre sends. The answer is held by TOKI-102 (its concern 1). Owner: Thanh Truong (product owner).
2. The words of the toasts. Not decided. The prototype has the toast "{first name} replied in {conversation}" and the prefix "Back from snooze: …". F13 gives the sense of the mention toast ("Minh mentioned you in #project-launch", the first 60 characters, View) but, by D-091 and D-139, a journey's wording is not an accepted text. The real data has a display name and no first name. The words for a mention, a mention of the channel, the unknown cases and the Vietnamese are proposals (R9, Texts). Proposal, not a decision: the English and Vietnamese of "Texts". Owner: Thanh Truong (product owner).
3. Which sound. Decided in this spec: one WAV made for Toki, two soft notes, 0.4 s, about 17.7 KB, written by a script in the repository (R1). Reason: no decision or prototype names a sound; the platform spec left the choice to this ticket and the product owner accepted that on 2026-11-18; a file we generate has no licence to track and no encoder to install, and a WAV plays in all four supported browsers. Anyone who wants another sound replaces one file and one constant in the script. Owner: Thanh Truong.
4. How the sound is unlocked. Decided in this spec: an element that a press has played is kept and reused (R3, R4), a silent play of it on the first click, key or touch end anywhere starts it (R5), and a refused play arms the step again (R6). Reason: Safari lets code play an element that a press started earlier, and the platform spec already says so as a belief it did not verify; the step costs one request of 17.7 KB and needs no setting. It is not verified on a real Safari or iPhone here, so R14 makes it a manual check recorded in the pull request, with the one change to make if it fails (a Web Audio context resumed in the press, inside `packages/platform` only). Owner: Thanh Truong.
5. A notice that is old. Not decided. TOKI-073 R17 drops the toast of a notice older than 60 seconds, a figure that spec proposes (its concern 5), and gives no rule for the sound of such a notice, so an event replayed after a lost connection would play a sound for a toast that is never shown. The sink cannot judge it: it receives the notice and not its age. Proposal, not a decision: a notice older than that limit plays no sound, decided in the centre where the age is known (Plan changes). Owner: Thanh Truong (product owner) with the owner of TOKI-073.
6. A burst of notices. Decided in this spec: one toast for each notice with no merging (R12), and at most one sound each second (R6, `SOUND_MIN_GAP_MS` 1,000). Reason: the prototype makes one toast for each message and the component already limits the screen to 3; TOKI-018 R20 restarts a sound that is still playing, so several notices in one moment would stutter. The 1,000 ms is a constant of the code, not a product rule, and can be changed. Owner: Thanh Truong.
7. The toast of a snoozed item that came back. Decided in this spec: the toast uses the sender and the start of the item when the notice carries them and says only "Back from snooze" when it does not (R9). Reason: the prototype shows the sender and the first characters; TOKI-073 R7 sends a null `preview` for this kind, so the full toast needs a change of TOKI-073 that is asked in Plan changes, and until then the shorter toast is correct, not broken. Owner: Thanh Truong.
8. What a press on a toast does. Decided in this spec: only the View button acts (R10), and it opens the message through `useOpenMessage()`, or Activity for a snoozed item. Reason: the prototype's toast has a button and no other action; F13 says "Pressing 'View' or the channel row opens #project-launch", and the row is already in the list. Owner: Thanh Truong.
9. Telling the person that the browser blocks the sound. Not decided. Neither the prototype nor a decision says that a person is told, in Preferences or elsewhere, when a browser refuses a sound; the unlock step is silent and a person who never presses anything in a page may hear nothing. Proposal, not a decision: say nothing in phase 1; the unlock covers the usual case at the first press. A test sound or a hint beside the switch would belong to TOKI-078. Owner: Thanh Truong (product owner).
10. Which toasts pass through this sink. Decided in this spec: only the three kinds of the notice (`message`, `mention`, `back_from_snooze`). The reminder toast is drawn by Later from its own event (TOKI-067 R22, TOKI-073 concern 12) and the summary toast at the end of Pause or Focus time by TOKI-076, which owns the count and the words; both use the toast component directly. Reason: a second toast event would double the reminder's toast, and the summary is not a notice of one message. TOKI-073's row 11 says the summary toast is TOKI-076's and TOKI-075's; the line is asked to change (Plan changes). Owner: Thanh Truong.
