# Intent: Sound and in-app notifications
Author: Thanh Truong

## Problem
When a person has Toki open and a message arrives in a conversation they are not looking at, nothing on the screen tells them. The server will soon decide who gets a toast and a sound (the notification decision engine), and the screen will judge whether each notice shows now, waits or is dropped, but nothing draws the toast, nothing plays the sound, and no sound file exists. The shared toast component exists and is used for Undo and confirmations; no code gives it a message to announce.
Sound has a second problem that a toast does not have. Browsers refuse to play a sound that the person has not asked for with a press, and Safari is the strictest: a sound started by code, when a message arrives, is refused unless the page has already played that sound once from a press. Without a deliberate step, a person who turned on 'Play a sound' would hear nothing in Safari, and in other browsers after a reload, with no sign of why.
Several rules must hold whatever the screen shows: a toast closes by itself after 5 seconds and has a View button that opens the message; toasts never cover the composer or the navigation; no sound plays when the person turned the switch off, during Pause or Focus time, in a conversation they are reading at the bottom with the window in use, or in a muted or silenced conversation; and a burst of messages does not stutter.

## Proposed outcome
A notice that the decision engine hands to the screen becomes a toast in the existing toast region, with the sender, the conversation and the start of the message, and a View button that opens that message (or, for a snoozed Activity item that came back, opens Activity). The toast lives 5 seconds, stacks with the others up to the component's limit, and stays above the composer and the navigation.
When the notice asks for a sound, one short sound file made for Toki plays once through the platform's sound feature. A burst of notices plays one sound, not several.
The browser's block on sound is lifted quietly: the first press or key anywhere in the app starts the sound once, silently, so that later sounds started by code are allowed, in Safari as in the other browsers. If a sound is still refused, the app arms the same step again for the next press.
Nothing about the decision changes here: who is notified, with which switch, and what is on the screen are decided by the engine.

## Affected users and systems
- Every Member and Admin who has Toki open on a device, on desktop and on a phone.
- The web app (`apps/web`): the sink that the notice centre calls, the host component that draws the toasts, the unlock step, the sound file and its address.
- The platform package (`packages/platform`): one more method on the sound feature and a more careful element handling.
- The i18n package: the toast texts in English and Vietnamese.
- Neighbours: the notification decision engine (TOKI-073), which sends the notices and owns the sink port; the notification switches (TOKI-102, TOKI-078); Jump to message (TOKI-068), which opens the message; the Activity screen (TOKI-066), which owns the badge and the label 'Back from snooze'; Web Push (TOKI-074), Pause and Focus time (TOKI-076) and Later (TOKI-067), which draw their own notifications.

## Constraints
- A toast for a message in another conversation has a View button, closes after 5 seconds, and names the sender, the conversation and the start of the message (60 characters). Source: F13 (journeys accepted as the baseline, D-091), the prototype's toast.
- Toasts and floating bars never cover the composer or the navigation. Source: D-078, F38.
- A sound plays only when the person's switch 'Play a sound' is on; the level decides toast, push and sound; Pause and Focus time stop all three; Mute also stops them, except a mention while the person's switch for it is on. Source: D-016, D-103, D-072, D-088, F13.
- No toast or sound for what the person is already reading. Source: F36, the 'When you are mentioned' table.
- The Safari sound unlock belongs to this ticket. Source: Toki Blueprint, ticket TOKI-075; the platform package spec (TOKI-018, Design).
- The sound file is chosen with this ticket, which also passes its address. Source: the platform package spec (TOKI-018, concern 1).
- The switches belong to the person and apply on every device. Source: D-142.
- Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Source: D-108.
- Every text goes through i18n; English is the default language; no text in `ui-web`. Source: D-139, TOKI-023.
- Timers in tests use the controllable clock. Source: TOKI-008.
- Milestone M5, size S. Needs TOKI-068 and TOKI-073. Source: Toki Blueprint, ticket TOKI-075.

## Open questions
- What does a toast show and do: where, how long, how it stacks, what a press does?
- Which sound does Toki play, and where does the file live?
- What is the default of 'Play a sound' for a new account?
- What are the final words of each toast?
- How is the browser's block on sound lifted, in Safari in particular?
- Does a notice that waited a long time, or that is replayed after a lost connection, still play a sound?
- Does a snoozed item that came back show its sender and text in the toast?
- Should the person be told when the browser blocks the sound?
- Who draws the toast of a reminder and the summary toast at the end of Pause or Focus time?
