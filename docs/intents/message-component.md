# Intent: Message component
Author: Thanh Truong

## Problem
After the sync engine (TOKI-040) and the virtual list (TOKI-041) the client holds every message of a conversation and draws each one as a stand-in: a box with the text and nothing else. A person cannot tell who wrote a message or when, cannot see that a message is still being sent or failed to send, and sees no line when someone joins, is added, leaves, pins a message or creates the channel.
Several pieces of work add something to a message: formatting and mentions change its text, reactions, files and thread links sit under it, the action bar sits over it, edits and deletes change what it shows, and pins add a label. Each of them needs a place in the message that is agreed before it is built, or each will edit the same file and the same layout.

## Proposed outcome
A message is drawn as the prototype draws it: the person's avatar, name and the time in 24 hours, then the text; consecutive messages from one person (the list decides which) show no avatar or name, and the time appears in the margin. A message that is not confirmed yet is faded; a message that waits for the connection says "Waiting to send"; a message that failed says "Not sent" in red, with Retry and Delete beside it, and Delete asks nothing. The grey lines for a person who joined, was added, left, pinned a message or created the channel are drawn from the data the server sends. The component also draws a message that a person sees in the thread panel.
The component has a small, fixed set of places that other work fills: the text (formatting, mentions), the label row beside the time (edited, pinned), the editor that replaces the text, the line of a deleted message, the files, the reactions, the action bar, the press on a name or avatar and the tint of a message that mentions the person. Each place has a name, a type and one file where it is filled.

## Affected users and systems
- Every Member and Admin who reads a conversation or a thread.
- The web app (`apps/web`): a new message folder under `conversation/`, the stand-in row of TOKI-041, and the texts of both languages in `packages/i18n`.
- The sync engine of TOKI-040 (its `retry` and `discard`), the date rules of TOKI-094, the patterns of TOKI-093.
- The work that fills the places: formatting (TOKI-049), mentions (TOKI-050), the action bar (TOKI-052), files (TOKI-062), reactions (TOKI-046), threads (TOKI-045), edit and delete (TOKI-047), pins (TOKI-048), the profile panel (TOKI-057).

## Constraints
- Time is shown in 24 hours for everyone. Source: D-123.
- A message that is not confirmed is faded; a waiting message shows "Waiting to send"; a failed one shows a red "Not sent" with Retry and Delete beside the time, and Delete asks nothing. Source: D-087, D-097, F11.
- A system line is grey and raises no unread count and no notification. Source: D-100, D-165.
- Consecutive messages from one person within 5 minutes are grouped, and the day dividers are drawn. Source: F10, D-091 (decided in TOKI-041, not repeated here).
- No feature may be hover-only: the time of a grouped message must be reachable on touch screens. Source: D-067.
- A date or time never shows "Invalid Date". Source: D-073.
- Every text goes through i18n and English is the default; a message text is never drawn as markup. Source: NFR-05, TOKI-041 Data safety.
- Every wording in quotes that the prototype does not contain is a proposal. Source: D-139.
- Milestone M3, size M. Needs TOKI-017, TOKI-041, TOKI-093, TOKI-094. Source: Toki Blueprint, ticket TOKI-042.

## Open questions
- Which ticket draws the day dividers and the grouping?
- Where do formatting, mentions, reactions, files, the action bar, edit, delete and pins plug into a message, and who edits what?
- What are the words of the system lines, of "Not sent", Retry and Delete, of a deactivated author and of an unknown author?
- How does a system line look, and how does a failed message look, when the prototype draws neither?
- How is the time of a grouped message reached on a touch screen, and where do the "(edited)" and "Pinned" labels go on a grouped message, which has no header?
- Does Retry work while offline, and what does Delete do to the focus?
