# Intent: Image thumbnails
Author: Thanh Truong

## Problem
A message will carry files (file storage, TOKI-058), and a file is always a download: it is stored as an opaque blob and is never drawn by the browser. That is right for safety and wrong for pictures. A person who sends a screenshot expects the readers to see it in the message, small, and to open it large, not to download a file to find out what it is.
Making a small copy of an image means reading the bytes of a file that a person chose, decoding it, and writing a new image. That is slow, it can take a lot of memory, and it runs a decoder on content from a user, which is the riskiest thing the server does with an upload. It must not run inside a request, it must not be able to bring the server down with a hostile file, and it must not leave anything behind when the file is removed.
The thumbnail is also not ready at the moment the message is sent. The message has to be shown at once, with a place for the picture that does not make the list jump, and every person who can see the message has to get the picture when it is ready, without a reload.

## Proposed outcome
When an image has finished uploading, the server queues one background job for it. A worker reads the stored image, makes one small copy in a safe format, stores it next to the original and records its size on the file. If the file is already part of a message by then, the worker also records a change on the message, and every open client receives one event that tells it the picture is ready. If the file is not in a message yet, the message simply carries the finished thumbnail from the first moment.
The thumbnail is served by the server to the people who may read the conversation, with the same access rule as the file, and cached by the browser. An image that cannot be turned into a thumbnail (a type the server does not draw, too many pixels, a damaged file) ends in a state that says so, so no placeholder stays on a screen for ever, and the file remains a normal download.
Nothing on screen is built here. The cards, the placeholder and the viewer are TOKI-062; this ticket gives them the data, the route and the event.

## Affected users and systems
- Members and Admins who send and read images in channels, direct messages and groups. Guests are not in phase 1 (D-152).
- The server app (`apps/server`): the `files` module (new columns of `files`, a job and its handler, a recurring sweep, one route, a reader of images), a small change to the `complete` route of TOKI-058, one image library as a dependency, and one new row in the change and event tables of `conversations` and `realtime`.
- The worker process of the job queue (TOKI-064), which runs the job.
- The shared package (`packages/shared`): the thumbnail shape on the file entry, its limits, the path of the route and the data of the new event.
- `packages/client-core`: the handler that puts the finished thumbnail into the held message.
- The neighbouring work: file storage (TOKI-058), which owns the file tables, the storage client and the access rule; the composer (TOKI-059); the cards and the viewer (TOKI-062); the Files tab and page (TOKI-063); the job queue (TOKI-064).

## Constraints
- Images get thumbnails; a message carries up to 10 files of up to 100 MB. Source: D-014, D-042, FR-10, AC-028, TS-044.
- A worker makes the thumbnail and the message is updated when it is done, by one more event. Source: Toki Blueprint plan (TOKI-060) and technical design ("Slow work is queued; when the worker finishes, one more event updates the message").
- In the message an image shows as a thumbnail that opens large; a thumbnail that is not ready shows a placeholder with the right proportions, so the layout does not jump. Source: F18.
- Only people who can see the conversation can open its files, and a private channel is never visible to an outsider, thumbnails included. Source: AC-029, BR-10, D-116, F18.
- A file is always downloaded and never run in the browser; every type is accepted up to 100 MB. Source: D-095.
- Deleting a message removes its files from storage; a file never sent is removed after 24 hours. Source: D-043, D-130.
- No virus scanning in phase 1. Source: D-186.
- Every change of data reaches clients through `recordChange` and the event handler; nothing else writes an event. Source: TOKI-036, "The event contract".
- A job carries identifiers only, is safe to run twice, reads the clock only through the clock it is given and uses the dependencies it is given. Source: TOKI-064 R7, R13, R19.
- One server for about 200 people on a single machine. Source: D-004, NFR-07.
- Every text on a screen goes through the i18n catalogue; English is the default. Source: TOKI-017 (this ticket adds no text).
- Milestone M4, size M. Needs TOKI-058 and TOKI-064. Source: Toki Blueprint plan, ticket TOKI-060.

## Open questions
- Which kinds of image get a thumbnail, and what do the others show?
- How big is a thumbnail, in what format, and does it keep the details of the photo (place, camera)?
- When does the job start: when the upload finishes or when the message is sent, and how does the message learn that the thumbnail is ready?
- How does the server read an image that a user chose without being brought down by it?
- What does the screen show while the thumbnail is not ready, and where do the proportions of the placeholder come from?
- What if the job fails for good, or is lost?
- How does the browser get a thumbnail, who may, and for how long may it keep it?
- Which image does the viewer show large?
