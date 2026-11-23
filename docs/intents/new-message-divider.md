# Intent: New divider, badges and filters
Author: Thanh Truong

## Problem
Once the read pointer gives each conversation its unread count, its @ mark and its first unread message, nothing shows them as a whole. A person who opens a conversation with unread messages must land on the first one and see where the new messages begin, and that mark must not move while they read. The list rows already draw a count and an @ mark, but they get raw numbers: a muted conversation must keep its @ mark only when the person's switch for mentions in muted conversations is on. The navigation has no Home number, the browser tab says nothing when the person is in another tab, and the Unread and Mentions chips stay empty because the device does not yet restore them.
Several rules have to hold together: the divider is anchored by message id at the moment of opening and is gone the next time; the Home badge counts unmuted conversations only; a muted conversation shows no count and no bold; the tab title shows `(3) Toki` for mentions and direct messages and a dot for anything else.

## Proposed outcome
The conversation page reads the first unread message once, when the conversation opens, and hands it to the message list as the place to open at and to draw the New divider before. The divider stays while the conversation is open and is not drawn at the next opening unless messages are still unread.
One set of pure rules in `client-core` turns the unread data and the person's settings into what a screen shows: the @ mark of a row (muted rows included), the Home number, and the tab title. The shell shows the Home number, the page writes the tab title, and the Unread and Mentions filters start working on the device.

## Affected users and systems
- Everyone who reads conversations: the divider, the row marks, the Home badge and the tab title.
- `packages/client-core`: the rules for badges and the title, and a small addition to the conversation store (the mention switch).
- `apps/web`: the hook for the divider in the conversation page, the Home badge in the shell route, the tab title, and the filter memory of the conversation list.
- Depends on the read pointer (TOKI-053, which gives the counts and the first unread message), the message list (TOKI-041, which draws the divider) and the conversation list (TOKI-033, which draws the rows and chips).
- No server change.

## Constraints
- The New divider anchors to the first unread message at the time of opening, by id so it does not drift, stays while the conversation is viewed, and is gone the next time it opens; opening a conversation with unread messages scrolls to it. Source: D-052, FR-08, AC-022.
- The Home badge is the total unread across unmuted conversations. Source: F08.
- A muted conversation shows no unread count and no bold (D-103) but keeps the @ mark while the person's switch for mentions in muted conversations is on, which it is by default (D-088); it is left out of the Home badge. Source: D-103, D-088, F08, journey of a mention in a muted conversation.
- The browser tab shows `(3) Toki` for mentions and direct messages and a dot for anything else. Source: D-122.
- Badges still update during Pause and Focus time. Source: D-072.
- A filter that matches nothing has its own empty state, and a count on a chip equals the rows shown. Source: D-074.
- Every decision about what to show (counts, where the divider sits) lives in `client-core`, so the web and phone interfaces cannot drift apart. Source: technical design.
- A grey system line, a thread reply and a person's own message raise no count; the count is kept for a muted conversation and for the level `none`. Source: D-100, F14, D-103 (given by TOKI-053).
- Every text goes through i18n; English is the default. Source: NFR-05.
- Milestone M4, size M. Needs TOKI-053. Source: Toki Blueprint, ticket TOKI-054.

## Open questions
- Does the divider appear for messages that arrive while the conversation is open?
- Is a mention in a muted conversation counted in the Home badge?
- Does the Home badge add up messages or conversations?
- What number does the tab title show: messages, conversations, or mentions?
- When does the tab title show the dot, and which character?
- Is a displayed number capped?
- Does the Mentions filter keep a muted conversation whose @ mark is hidden?
- When a conversation opens at a given message and also has unread messages, which one does the list open at?
- Does a muted conversation still get a divider?
