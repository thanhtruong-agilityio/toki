# Intent: Jump to message
Author: Thanh Truong

## Problem
Several places in Toki point at one message: a result of Ctrl+K, a result of the search inside a conversation, a file card's "Open in conversation", the Pinned tab, an Activity item, a row of Later, a toast's "View". Each of them has to end in the same way: the conversation of that message is open, the list shows the message, and the message flashes so the eye finds it. A reply is not a row of the list unless it was also sent to the channel, so for a reply the end is the thread panel with the reply in view.
The specs written so far call one hook, `useOpenMessage`, and say another ticket owns it. Nothing yet says what it takes, what it does for a message of another conversation (whose page does not exist yet when the call is made), who draws the flash, and what a person sees when the message or the conversation can no longer be opened. If each caller answered those questions alone, the app would have several ways to open a message and several flashes.

## Proposed outcome
One hook, `useOpenMessage()`, returns one function that takes the conversation, the message and the parent of the message. For a message of the list it opens the conversation at the message, in the open conversation or in another one, and flashes the row for two seconds. For a reply it opens the thread panel of the root with the reply in view, through the thread address. It adds no wording of its own, works while the connection is down for what is already held, and is the only way any screen opens a message.

## Affected users and systems
- Every Member and Admin who presses a message result, a file card's button, a pinned message, an Activity item, a Later row or a toast's View. A Guest is a phase 5 role (D-090, D-152) and is not built here.
- The web app (`apps/web`): the page of a conversation (TOKI-041, TOKI-054), the thread address and panel (TOKI-045), the archived page's history (TOKI-101), the signed-in layout that holds the provider.
- The callers that already name the hook: the attachment window (TOKI-062), the Files section and tab (TOKI-063), the command palette (TOKI-071), the search inside a conversation (TOKI-072), Pinned (TOKI-048).
- The tickets that will call it: Activity (TOKI-066), Later (TOKI-067), toasts (TOKI-075), Web Push (TOKI-074).
- No server code, no table and no route: every request the jump makes is one the list already makes.

## Constraints
- A message opened from Activity, Later, a search result or a toast shows its conversation, scrolls to the message and flashes it for 2 seconds. Source: flows F09, F13, F19, F27, F29; prototype `highlight` and `.msg.hl`.
- A reply opens the thread panel of its root, and the address of a thread is its own (Back closes the panel first). Source: D-089, F27.
- A person who cannot read a conversation sees no content of it: a private channel gives "no access", a public channel that was not joined gives its name and a Join button. Source: D-116, F09 cases.
- Loaded content stays readable when the connection drops; what needs the server is not faked. Source: D-079.
- A deleted message with no replies is gone for everyone; one with replies is a "Message deleted" line. Source: F16, D-049.
- Every text goes through i18n with English as the default; a wording the prototype does not contain is a proposal. Source: NFR-05, D-139.
- Nothing works by hover alone. Source: D-067.
- Milestone M4, size S. Needs TOKI-041. Source: Toki Blueprint, ticket TOKI-068.

## Open questions
- What exactly does the hook take, and is `parentId` required, optional or `null`-able? The callers disagree.
- A message of another conversation has no page yet when the call is made. How does the first opening at that message reach the page?
- Who draws the flash, for how long, and what does it do under reduced motion?
- A reply: does the jump open the thread, and does the reply flash?
- What does the person see when the message was deleted, the conversation is archived, or the person can no longer read it?
- Does a message have an address of its own, for a link or a push click?
- What does a caller that is offline get?
