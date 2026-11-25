# Intent: Attachments in the composer
Author: Thanh Truong

## Problem
A person writing a message cannot attach a file. The server will store files and link them to a message (TOKI-058), and the composer has a place for cards and a gate on Send (TOKI-043), but nothing on screen lets a person pick a file, drop one on the chat or paste an image, see it upload, take it back out, try again when an upload fails, or know when the message can be sent.
Several small rules are easy to get wrong. A message carries up to 10 files and each file is up to 100 MB; a file over the limit must be refused with its name in the message and never uploaded. Send must wait until every file has finished uploading. The browser sends the bytes straight to storage, so the progress shown has to come from that transfer, not from the app server. Uploading is one of the actions that stay blocked while the connection is down, and the person must be told why. When the disk is full the server refuses the upload and the person must see the reason, not a bare failure. A file that was uploaded and never sent stays on the server for 24 hours, and a draft restores text only, so the composer must not pretend to restore files.

## Proposed outcome
In the composer of a conversation the toolbar has an attach button. Pressing it opens the file dialog; files can also be dropped anywhere on the chat or an image pasted from the clipboard. Each file becomes one card above the field, as the prototype's `.fchip`: file icon, name, size, a progress bar while it uploads, a remove button, and Retry when an upload fails. A file over 100 MB gets a red card with the text "Over 100 MB" and is not uploaded. An eleventh file is refused with a message and the ten stay. Send is disabled until every card has uploaded; a message may then be sent with files and no text. While the connection is down, picking, dropping, pasting and Retry do nothing except tell the person that files cannot be uploaded offline. A refused upload because the disk is full shows the reason on the card. Leaving the conversation drops the cards and the files that were never sent.
It does not build the server side (TOKI-058), the file and image cards inside a sent message or the viewer (TOKI-062), thumbnails (TOKI-060), link previews (TOKI-061), the Files page (TOKI-063), or the thread box's own wiring (TOKI-045).

## Affected users and systems
- Every Member, Admin and Guest who writes a message: they add files and see cards.
- `packages/platform`: the upload of a picked file to storage, with progress.
- `packages/client-core`: the calls of the file routes, and the rules of the cards (limits, queue, retry, send gate).
- `packages/ui-web`: the card, the drop and paste target.
- `packages/i18n`: the texts and the file size format.
- `apps/web`: the attach button, the wiring into the composer and the conversation page.
- Neighbouring work: the file storage (TOKI-058), the composer (TOKI-043), the sync engine (TOKI-040), the offline gate (TOKI-093), the disk warning and its refusal text (TOKI-103), the thread box (TOKI-045), the message component and the cards in sent messages (TOKI-042, TOKI-062).

## Constraints
- A message carries up to 10 files, each up to 100 MB; every file type is accepted. Source: D-042, D-014, D-095, FR-10, AC-026, AC-027, TS-041, TS-042.
- The card shows name, size, a progress bar and a remove button; a file over 100 MB turns red with "Over 100 MB" and is not uploaded; an upload that fails midway gets a Retry button; sending is possible once every file has uploaded. Source: journey F18, the prototype (`.fchip`, `rmfile`, `attach`).
- Files are picked with the paperclip, dropped on the chat or pasted as an image. Source: journey F18.
- Uploading is blocked while offline, with the reason; messages are the only thing that waits. Source: D-060, D-079.
- When the disk is 95% full uploads are refused with the reason while messaging keeps working. Source: D-106, TOKI-103 R17.
- A draft is text only; files are not restored on return or on another device. A file uploaded and never sent is deleted after 24 hours. Source: D-168, D-130.
- The bytes go from the browser to storage, not through the app server. Source: technical design, TOKI-058 R7.
- Every text goes through `@toki/i18n`; `ui-web` holds no text. English is the default. Source: D-064, TOKI-017.
- Milestone M4, size M; needs TOKI-043, TOKI-058. Owns `.fchip`. Source: Toki Blueprint, ticket TOKI-059; TOKI-012 ownership table.

## Open questions
- Where does the code that sends the bytes live, given that `client-core` may use no XMLHttpRequest, File, Blob or FormData?
- How many files upload at the same time, and is there a time limit on an upload?
- Does a card count toward the 10 when it is red, and can a message be sent while a card is red or failed?
- What happens to the cards when the person leaves the conversation, switches to the Pinned tab, or reloads?
- What exactly is pasted: only images, or any file on the clipboard?
- What does the composer do when the server says the person already holds too many unsent files?
- What does a message with files and no text look like while it waits to send, and what if its files expire while it waits?
- Which texts does the card show, and which of them does the prototype have?
