# Intent: Synced drafts
Author: Thanh Truong

## Problem
A person who starts a message and does not send it expects to find the text again. The composer keeps it in the browser, but only in that browser: on a phone, a second computer or after the browser's data is cleared, the text is gone. Journeys F06, F07 and F11 and requirement FR-38 promise more: the text is saved to the person's account, appears on their other devices, is still there after signing out and in, is cleared when the message is sent, and the conversation shows a "Draft" label in the list while it is not open.
Without this work a draft is private to one browser, and the conversation list never says that a conversation has unsent text.

## Proposed outcome
Every draft the composer keeps, one for each conversation and one for each thread, is also saved to the server for that person. The text appears in the composer of another device of the same person, and a change made on one device reaches the person's other open devices. Sending the message, or emptying the field, removes the draft everywhere. A draft is text only. A conversation that has a draft and is not open shows a "Draft" label in the conversation list; blank text is not a draft. A draft that could not be saved (offline, a failed request, the session ending under the person) stays in the browser and is saved later, and pressing "Sign out" saves the drafts first.

## Affected users and systems
- Every signed-in person, Members and Admins alike, on every device they use.
- The server app (`apps/server`): a new module with a drafts table and the requests that save, remove and list the drafts of the signed-in person; one live notice to that person's other connections.
- The shared package (`packages/shared`): the shapes of the requests, the answers and the notice, and the draft key and size limit.
- The client package (`packages/client-core`): the API methods and the store that saves, merges and applies drafts behind the `DraftStore` of the composer (TOKI-043).
- The web app (`apps/web`): the wiring of the store, the task that runs before Sign out (TOKI-099), the "Draft" label in the conversation list (TOKI-033).
- The composer (TOKI-043) and the thread box (TOKI-045) use the store through their existing draft hook and change no code.

## Constraints
- Drafts are saved to the person's account, appear on their other devices and survive sign-out and sign-in. Source: FR-38, AC-103, journeys F06, F07 and F11.
- A draft is kept per conversation and separately for each thread; the text is cleared when the message is sent. Source: FR-38, AC-102, AC-104.
- A draft is text only; attached files are not restored on return or on another device. Source: D-168.
- Blank text (only spaces or line breaks) is not a draft and produces no "Draft" label. Source: AC-102, TS-160.
- A conversation that has a draft and is not open shows a "Draft" label in the conversation list. Source: FR-38, state "Has a draft" of the Blueprint context.
- Pressing "Sign out" saves unsynced drafts to the server first, and a sign-out never waits for ever on them. Source: journey F06; TOKI-099 concern 7.
- A draft that could not be saved to the server stays in the browser across a sign-in, and is dropped when another person signs in on that browser. Source: product owner's decisions of 2026-11-19 (TOKI-023 concern 8, TOKI-099 concern 10), D-132.
- Nobody but the person sees a draft, and a draft of a conversation the person cannot read is never returned. Source: BR-10, D-051, D-116.
- A request with no answer after 10 seconds counts as failed; every request goes through `/api/v1` with one error format; messages and drafts wait offline without an error shown to the person. Source: D-126, D-125, D-079.
- How long a draft is kept, and what happens when two devices edit it at once. Source: D-169 (Open in the log).
- Milestone M3; size S. Needs TOKI-043. Source: Toki Blueprint, ticket TOKI-051.

## Open questions
- How long is a draft kept, and what happens when the same draft is edited on two devices at once? The log has D-169 as Open; its proposal is "kept until sent or emptied, no expiry; the last save wins".
- What happens to a draft of a conversation the person has left, was removed from, or that was archived? No decision names it.
- When another device changes a draft while the person has that conversation open and is typing, does the text in the field change? No decision names it.
