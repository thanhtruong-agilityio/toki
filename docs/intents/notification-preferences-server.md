# Intent: Notification preferences (server)
Author: Thanh Truong

## Problem
A person decides how Toki may interrupt them: a system notification on the desktop, a sound, and whether a mention still gets through in a conversation they muted. Today none of this is stored anywhere. The prototype keeps the switches in the browser, so a person who turns the sound off on the laptop hears it on the phone, and the notification logic that comes later has nothing to read.

The switches belong to the person, not to a device. Only the browser's permission to show push notifications is a property of one device. When a switch is changed on one device, the person's other devices have to show and obey the new value at once, and nobody else may see it.

## Proposed outcome
The server keeps three switches for each account: Desktop notifications, Play a sound, and "Notify me for @mentions even in muted channels", which is on until the person turns it off. A person reads them with the sign-in data of the app and saves a change with one request. A saved change is written as an event for that person only, so every device they have open updates without a reload, and a device that was offline learns of it when it reconnects. A device that is signed in for the first time reads the saved values with the first load.

The server code that decides who gets a toast, a push or a sound can read the three switches of any person through one function. The screens that show the switches, and the logic that obeys them, are other work; this work gives them the data, the request, the event and the value on the client.

## Affected users and systems
- Every Member and Admin: the three switches, on every device they use.
- The server app (`apps/server`): the `notifications` module (one table, one route, the event), the bootstrap answer, the event handler of the WebSocket gateway.
- The shared package (`packages/shared`): the names, the defaults, the request and answer schemas, the event payload, one key of the bootstrap answer.
- The client (`packages/client-core`, `apps/web`): one API method, the held value in the conversation store, the event, the hook that a screen reads and saves through.
- Later work that reads the switches: the notification decision engine, web push, sound and in-app notifications, the Preferences screen, the badge rule for a mention in a muted conversation.

## Constraints
- Exactly three switches in phase 1; there is no switch for email about missed mentions. Source: FR-44, AC-123, D-016.
- "Notify me for @mentions even in muted channels" is on for an account that has never changed it. Source: D-088, AC-124.
- One set of switches for the person, the same on every device; only the browser's push permission is per device. Source: D-142, AC-125.
- A change made on one device reaches the person's other devices at once, and nobody else. Source: AC-125, TS-199, D-142.
- The saved value is read by the later notification logic: a muted conversation still notifies a mention only while the switch is on, and the level or Mute never changes the switch. Source: D-088, D-103, AC-039.
- Time and ordering use the controllable clock and the event number, never a real timer. Source: TOKI-008 R19.
- Every text goes through i18n; English by default. Source: D-018, NFR-05.

## Open questions
- What are "Desktop notifications" and "Play a sound" set to for an account that has never changed them?
- Where are the switches stored, and how does a second device learn of a change at once?
- Who owns the request that saves the other preferences (look, language, profile), and where is the line with this one?
- What does a person get when they save the value they already have?
- Do the switches affect anything other than toast, push and sound?
