# Intent: Files tab and Files section
Author: Thanh Truong

## Problem
A person who shares a file, an image or a link in a conversation cannot find it again except by scrolling the conversation. There is no place that lists what was shared, and nothing to narrow it by kind or by name.
Every file, image and link must also be listed only for people who can read the conversation it was shared in. A private channel's files must never show up for an outsider, a person who left a channel must stop seeing its files, and the files of an archived channel stay for its members.
The development sample workspace has messages but no files or images, so these screens would open empty.

## Proposed outcome
A Files section lists every file, image and link from the conversations the person can read, newest first. The person narrows it with a search by file name or sender and with the chips All, Images, Documents and Links, and switches between a list and a grid. When nothing matches, the screen says so and offers to clear the filters.
Each conversation gets a Files & links tab that lists the same kind of items for that conversation only.
Pressing an item opens the details window of the attachment cards (sender, conversation, date, size, Open in conversation, Copy link, Download).
The sample workspace gains the prototype's sample files and images, so both screens have content after the seed.

## Affected users and systems
- Members and Admins, who read the section and the tab. Guests are not in phase 1 (D-152).
- The web app (`apps/web`): the Files section and its route, the tab in the conversation page, and the use of the details window.
- The component package (`packages/ui-web`): the segmented list or grid switch.
- The server (`apps/server`): one request that lists shared items, with reads added to the file, link preview, message and conversation modules.
- The shared package (`packages/shared`): the request and response shapes.
- The seed command and the seed data of the sample workspace (TOKI-081).
- File storage (TOKI-058), thumbnails (TOKI-060), link previews (TOKI-061) and the attachment cards and window (TOKI-062), which supply the data and the parts this work shows.

## Constraints
- The section lists files, images and links of the conversations the person can see, newest first, with search by file name or sender, the chips All, Images, Documents and Links, and a list or grid switch. Source: FR-39, F30, D-002.
- The search and a chip apply together; "No files match" with a Clear filters button when nothing matches. Source: AC-106, F30.
- Files and links of a private channel, a direct message or a group never appear for a person who cannot read it; a person who left a channel no longer sees its files; an archived channel's files stay for its members. Source: F30, AC-105, D-116, D-170.
- Each conversation has a Files & links tab that lists only that conversation's items. Source: FR-39, AC-105, F10.
- Pressing an item opens the details window of F18. Source: FR-39, AC-107.
- How many rows load at once, and what the chip Documents holds, are not settled in the log. Source: D-171 (open).
- Every text goes through the i18n package; English is the default language. Source: Toki Blueprint, TOKI-017.
- Milestone M4; size M. Needs TOKI-062, TOKI-081 and TOKI-094. Source: Toki Blueprint, ticket TOKI-063.

## Open questions
- The log has no server list of files and the search of TOKI-070 does not search by file name: does the Files section search on the client, or does it need a list from the server, and who builds it?
- What exactly is a link item: every address in a message, or only a link that has a preview card?
- Which kind is an image whose thumbnail could not be made: Images or Documents?
- Does the conversation tab have the chips, the search and the grid, or only the list?
- Which sample files, images and links does the seed get, given that the sample leaves out the guest's channel and the link card of `l1`?
- Which ticket owns the jump from the Files section to a message in another conversation?
