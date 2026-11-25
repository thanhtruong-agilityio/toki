# Intent: Composer
Author: Thanh Truong

## Problem
A person who has a conversation open cannot write in it. The message API stores messages (TOKI-037) and the sync engine sends them optimistically (TOKI-040), but no screen has a field to type in, a button to send with, or a place that keeps unsent text. Writing a message has several small rules that are easy to get wrong: Enter sends and Shift+Enter makes a new line, but Enter must not send while a Vietnamese word is still being composed; the field grows with the text up to a height and then scrolls; a message over 10,000 characters cannot be sent and the person must be told; a text of only spaces is not a message; text that is typed and not sent must be there again when the person comes back to the conversation, also after the session ended, and must not be shown to another person who signs in on the same browser.
Three conversations are not writable and the composer must not appear or must be replaced: an archived channel, a direct message with a deactivated person, and a conversation the person is not a member of. Later work builds on the composer: mentions, formatting buttons, synced drafts, attachments and the thread reply box. They need fixed places in it, so the composer must offer them without being rewritten.

## Proposed outcome
Every conversation page the person can write in has a composer under the message list, as in the prototype: a field with the placeholder "Message #name" (or the person's name for a direct message), a toolbar row with the Send button, Enter to send, Shift+Enter for a new line, no send while an input method is composing a word, a field that grows to 160 px and then scrolls, and a counter that appears near the 10,000-character limit and locks Send beyond it. Pressing Send puts the message in the list at once through the sync engine, empties the field, keeps the focus and tells the typing indicator that the person stopped. Unsent text is kept as a draft in the browser for each conversation, restored on return and dropped when another person signs in there. A direct message with a deactivated person shows a notice where the composer would be. The composer names its extension points (text insertion, key handling, toolbar slots, a draft store, an attachment slot, a send gate) so that mentions, formatting, synced drafts, attachments and the thread box add to it instead of changing it.
It does not build mentions, formatting buttons, synced drafts, attachments, the thread panel, the typing signal or the message list.

## Affected users and systems
- Every Member and Admin with a conversation open: they type and send.
- `packages/client-core`: the rule for the text that is sent, and the browser draft store.
- `packages/ui-web`: the composer component, which draws and takes its texts as props.
- `apps/web`: the connected composer on the conversation page, the draft storage adapter, the texts in `@toki/i18n`.
- Neighbouring work: the sync engine (TOKI-040), the typing sender (TOKI-044), the message list (TOKI-041), mentions (TOKI-050), synced drafts (TOKI-051), attachments (TOKI-058, TOKI-059), threads (TOKI-045), formatting (TOKI-049), the archived channel page (TOKI-101).

## Constraints
- Enter sends, Shift+Enter makes a new line, the field grows to 160 px and then scrolls; the placeholder is "Message #name". Source: journey F11, the prototype (`composerHtml`, `.cbox textarea`). F11 gives no rule for a touch device.
- The composer is part of the Messages tab only, not of the Pinned tab or later tabs. Source: journeys F10 and F11, the prototype (`S.tab==='messages'`).
- Mid-word while typing Vietnamese, Enter finishes the word and does not send. Source: journey F11.
- A message has 1 to 10,000 characters; a text of only spaces or line breaks is not sent; the counter appears near the limit and Send is locked beyond it. Source: D-042, FR-09, AC-024, TS-037, TS-038, journey F11.
- The composer sends through the sync engine: the message shows at once, a message pressed offline waits, one that fails is "Not sent". The composer keeps the focus after sending. Source: journey F11, D-079, D-097, D-087, TOKI-040.
- Unsent text is kept per conversation, is text only (no files), is back on return, survives a sign-in of the same person and is dropped when someone else signs in on that browser. Source: FR-38, D-168, decisions of the product owner of 2026-11-19 in the specs of TOKI-023 (concern 8) and TOKI-099 (concern 10), which apply the pattern of D-132 (a waiting message is dropped when someone else signs in) to drafts.
- The composer tells the typing indicator when the person types and when they stop. Source: TOKI-044 R9.
- Toasts never cover the composer, which registers with `useToastAvoid`. Source: D-078, TOKI-013 concern 8, TOKI-015 R25.
- From 720 to 1099 px a side panel overlays the chat, and the layout of the composer in that case belongs to this ticket. Source: TOKI-015 concern 5 (decided by the product owner on 2026-11-18), D-068.
- An archived channel shows "This channel has been archived" in place of the composer; a direct message with a deactivated person is read-only. Source: D-029, F26, F25, F41, TOKI-037 R6 and R7, TOKI-101 R17.
- Every text goes through `@toki/i18n`; `ui-web` holds no text. English is the default. Source: D-064, TOKI-017.
- Milestone M3 "Real-time chat", size M. Needs TOKI-040; needed by TOKI-050, TOKI-051, TOKI-059. Source: Toki Blueprint, ticket TOKI-043.

## Open questions
- How is "no send while composing a Vietnamese word" detected across browsers, and how is it proved?
- Where does a draft live before synced drafts exist, and what happens to it when another person signs in?
- What does the composer do when the conversation becomes archived, or the other person of a direct message is deactivated, while it is open or after a send was refused?
- Where does the composer sit when a side panel overlays the chat from 720 to 1099 px?
- What does the composer offer to mentions, drafts, attachments and the thread box, which are built later?
- When does the counter appear and what does it say?
- What does Enter do on a phone, whose soft keyboard has no Shift+Enter?
- Which ticket builds the Emoji button that journey F12 lists in the toolbar, and what does it insert (D-017: 8 fixed emoji, no picker)?
