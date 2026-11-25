# Intent: Edit and delete messages
Author: Thanh Truong

## Problem
A person can send a message but cannot correct it or take it back. A typo stays, a message sent to the wrong conversation stays, and an Admin has no way to remove a harmful message. The tables already hold the columns for this (`edited_at`, `deleted_at`, `deleted_by`) and the permission functions already say who may edit and who may delete, but no request writes them and no screen offers them.
Without this work the message list can only show messages as they were sent, and the rules around them have no owner: what a deleted message leaves behind, what happens to its thread, its files, its pin and the mentions in it, and how the author learns that an Admin deleted a message.

## Proposed outcome
The author of a message edits its text in place, at any time, with no limit and no history; everyone then sees the new text with "(edited)" beside the time. The author deletes their own message after a confirmation that names it; there is no Undo. An Admin who is a member of a conversation deletes another person's message after a confirmation that names the author; an Admin never edits another person's message.
A deleted message with no replies disappears for everyone. A deleted message with replies stays as a line, and its thread stays readable. A message deleted by an Admin always stays as a line that says an Admin deleted it, and its author is told. The files of a deleted message leave storage and can no longer be opened or found. The server refuses every edit and delete that the rules do not allow, whatever the screen showed, and every open client shows the change at once.

## Affected users and systems
- Members and Admins who write in channels, direct messages and groups; an Admin who deletes another person's message.
- The server app (`apps/server`): two routes in the `messages` module, two changes for the event log, and two seams for the work that follows (files, mentions and Activity).
- The shared package (`packages/shared`): the request and response shapes, one error code, the `deletedBy` key of a message and two event kinds.
- `client-core` and `apps/web`: the requests, the handling of the two events, the in-place edit field, the "(edited)" label, the delete confirmation and the lines that stand in place of a deleted message.
- The neighbouring work: the sync engine (TOKI-040), the message list and the message component, the composer, threads, reactions, pins, files, mentions, search and Activity, each of which reads a message that was edited or deleted.

## Constraints
- No time limit on editing and no edit history; an edited message is marked "(edited)". Source: D-013, FR-11, F16.
- Only the author edits. An Admin deletes another person's message only in a conversation the Admin belongs to; an Admin never edits it. Source: BR-24, BR-26, D-047, F42, the capability table rows 9 and 10.
- Deleting asks for a confirmation that names its target and offers no Undo. Source: D-069, D-061, AC-031, AC-078.
- A deleted message that has replies keeps its thread, and a reply written while the root is deleted is still sent. Source: D-013, D-096, AC-032.
- A message deleted by an Admin reads "Message deleted by an admin" for everyone, even with no replies, and its author is told. Source: D-049, F42, AC-034.
- The files of a deleted message are removed from storage and from Files. Source: D-043, AC-033.
- A deleted message leaves the Pinned tab. Source: D-166.
- A message sent with "Also send to channel" is one message: editing or deleting it changes both places. Source: D-160.
- Editing to add a mention notifies the newly mentioned person; removing a mention removes the earlier notification. Source: F16, F13.
- Edit and delete are blocked while offline, with an explanation; only sending waits. Source: D-079, F11.
- Permission is checked on the server for every request; "no access" to a private conversation reads as "not found". Source: BR-09, BR-10, D-045, D-125.
- An archived channel takes no edit and no delete. Source: TOKI-027 concern 3 (decided by the product owner on 2026-11-19), BR-11.
- Every text goes through i18n; the wording that the prototype does not contain is a proposal. Source: NFR-05, D-139.
- Milestone M3; size M. Needs TOKI-040 and TOKI-093. Source: Toki Blueprint, ticket TOKI-047.

## Open questions
- Is there a time limit on editing, and does a delete offer Undo?
- What does a deleted message look like when it has replies, when it has none, and when an Admin deleted it?
- Is the confirmation a dialog or the line under the message that the journey draws?
- May a person edit or delete their own message in a direct message whose other person was deactivated?
- What does "has replies" count: every reply, or only the replies that were not deleted?
- Which ticket removes the files of a deleted message?
- What does an edit do to mentions, pins, threads and reactions?
