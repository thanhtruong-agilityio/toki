# Intent: Pins and the Pinned tab
Author: Thanh Truong

## Problem
Decisions and links get lost in a busy conversation. Today a message can be sent and read, but nobody can mark one as worth finding again, and there is no place that lists such messages.
Without this work the Pinned label, the system line "who pinned it", the Pinned tab and the Pin and Unpin items of the message menu have nothing to call, and the prototype's sample pins cannot be seeded.

## Proposed outcome
A Member or Admin who is in a conversation pins a message from its More menu, their own or another person's, and unpins it from the same menu. Both happen at once, with no confirmation, and a toast offers Undo for 5 seconds.
A pinned message carries a 'Pinned' label for everyone in the conversation, the conversation shows a grey system line that says who pinned it, and the Pinned tab lists the conversation's pinned messages, the most recently pinned first. An empty tab says 'Nothing pinned' and tells the person what a pin is for. Pressing an entry of the tab shows that message in the Messages tab.
Pinning and unpinning reach the other members live. A deleted message leaves the tab; a reply inside a thread cannot be pinned.

## Affected users and systems
- Members and Admins of a conversation of any kind (channel, direct message, group).
- The server app (`apps/server`): a table of pins, three routes (pin, unpin, list), the system line and the two events, in the `messages` module and, for the events, the handler of the `realtime` module.
- The shared package (`packages/shared`): the `pinned` key of the message entry, the schemas of the three routes, one new system-line type, two event kinds and one error code.
- `client-core`: a store of the pinned lists, two event handlers on the sync engine, three API methods.
- The web app (`apps/web`): the Pinned tab, and the hook that the message menu calls to pin and unpin.
- The neighbouring work: the message component (the label and the line's text), the message menu, the tab row of the conversation view, edit and delete, and the seed data.

## Constraints
- Any Member or Admin who is a member of a conversation can pin and unpin any message in it; Guests are not built in phase 1. Source: FR-36, AC-096, D-090; `canPinMessage` of TOKI-027.
- Pin and unpin happen at once, show a toast with Undo for 5 seconds and never ask for confirmation. Source: D-061, D-069, AC-098; TOKI-093 (`pinMessage`, `unpinMessage`).
- A pinned message carries a 'Pinned' label; pinning adds a system line that says who pinned it, with no unread count and no notification; unpinning adds no line. Source: FR-36, F17, D-165, D-100.
- The Pinned tab lists the pinned messages, the most recently pinned first, and pressing an entry shows the message in the Messages tab. Source: FR-36, F17, AC-097.
- A conversation has no limit on the number of pinned messages. Source: D-164.
- A deleted message leaves the Pinned tab; only a message of the main list can be pinned, not a reply inside a thread. Source: D-166.
- An empty Pinned tab reads 'Nothing pinned' and 'Pin a decision or a link so people can find it later.' Source: prototype (empty state of the Pinned tab), F17.
- A private channel, a direct message and a group are visible to their members only; an archived channel is read-only. Source: BR-09, BR-10, D-045, F26, BR-11; TOKI-027.
- While the connection is down every write, a pin included, is blocked. Source: F18, D-079.
- Permission is checked on the server for every request. Source: D-125.
- Every text goes through i18n; English is the default language. Source: NFR-05.
- Milestone M3; size S. Needs TOKI-040 and TOKI-093. Source: Toki Blueprint, ticket TOKI-048.

## Open questions
- Is there a limit to the number of pinned messages in a conversation?
- Does the 'pinned a message' line raise an unread count or notify anyone, and is there a line for unpinning?
- What happens to a pin when its message is deleted, and can a reply inside a thread be pinned?
- Who draws the tab row under the conversation header, and who draws the Pinned tab in it?
- Does Undo of a pin remove the line it added, and does Undo of an unpin put the message back at its old place in the tab?
- Can a message be pinned or unpinned in a direct message with a deactivated person, which is read-only?
