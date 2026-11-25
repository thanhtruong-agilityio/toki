# Intent: Mentions
Author: Thanh Truong

## Problem
People write messages and read them, but nothing lets one person call another by name. Typing `@` does nothing, a name in a message is plain text, nobody is told, and the message of someone who was named looks like any other.
Without this work Activity (TOKI-065), the notification engine (TOKI-073), the unread `@` dot and the Mentions filter (TOKI-053, TOKI-054), and the follow rule of threads have no record of who was mentioned in which message.
Several rules must hold whatever the screen shows: only people in the conversation are suggested and only they are mentioned; a name typed for someone outside the conversation notifies nobody; `@channel` is for channels, and in a big channel it asks first; an edit that adds a mention and an edit that removes one are both noticed.

## Proposed outcome
Typing `@` or pressing the mention button in the composer opens a list of the conversation's members, with `@channel` in a channel. Typing narrows the list, with or without diacritics. The arrow keys choose, Enter or Tab inserts the name, Esc closes the list.
When the message is stored, the server finds the people it names, keeps them with the message and returns them in every copy of the message. The message of a person who was mentioned has a tinted background, and the name shows as a chip.
`@channel` in a channel of 20 or more people asks for confirmation, naming the number. A name typed for someone who is not in the conversation notifies nobody, and the sender is offered "Add them".
Editing a message recomputes its mentions: the people newly named are told apart from those already named, and a person whose name was edited out is no longer mentioned.

## Affected users and systems
- Members and Admins, who write, edit and read messages in channels, direct messages and groups.
- The shared package (`packages/shared`): the rule that finds a mention in a text, the shape of the mentions of a message and the limit for the confirmation.
- The server app (`apps/server`): a `mentions` module with the table, the writer called by the send, reply and edit transactions, and the reader the message builder calls.
- `client-core` and `apps/web`: the mention list, the button, the confirmation, the offer to add people, the tint and the chip.
- The neighbouring work: the composer (TOKI-043) gives the places; the message component (TOKI-042) and text formatting (TOKI-049) draw the tint and the chip; edit (TOKI-047), threads (TOKI-045), the read pointer (TOKI-053), Activity (TOKI-065) and the notification engine (TOKI-073) read what this work stores.

## Constraints
- The suggestions are the members of that conversation only, guests included, plus `@channel`; people outside the conversation are not suggested and not notified. Source: D-058, F12.
- The list matches with or without diacritics; arrow keys choose, Enter or Tab inserts, Esc closes. Source: F12 (accepted baseline, D-091), the prototype.
- Any member of a channel can use `@channel`; in a channel of 20 or more people it asks for confirmation first, and cancelling sends nothing. Source: D-041, FR-17, AC-044, TS-067, TS-068; TOKI-027 R6 (a channel only).
- A name typed for someone outside the conversation notifies nobody and the sender is offered "Add them". Source: D-135, F12.
- A deactivated person is not in the mention suggestions. Source: F41, context (states).
- Mentioning yourself creates no item and no badge. Source: FR-14, AC-037.
- On the mentioned person's screen the whole message has a tinted background, `@channel` included; the name shows as a chip. Source: F12, F13, the table "When you are mentioned in a channel", the prototype.
- Editing to add a mention notifies the newly mentioned person; removing a mention removes the earlier notification. Source: F16, F13.
- Message text is stored as sent and never rendered as raw HTML. Source: TOKI-037 R4.
- Routes under `/api/v1`, permission checked on the server. Source: D-125, BR-09.
- Phase 1 has `@channel` only: no `@here` and no `@everyone`. Source: D-017.
- Milestone M3; size M. Needs TOKI-043 and TOKI-093. Source: Toki Blueprint, ticket TOKI-050.

## Open questions
- How is a mention written in the text, and how does the server know whom it names?
- Which people does the list show, and are there `@here` and `@everyone`?
- Who may use `@channel`, and what does the confirmation say?
- What happens to a name typed for someone outside the conversation?
- What does a deactivated person do to a mention?
- What does an edit do to the mentions of a message?
- Which ticket draws the chip and the tint?
