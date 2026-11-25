# Intent: File storage
Author: Thanh Truong

## Problem
A message can carry only text. The composer cannot attach a file, the message list cannot show one, and nothing stores a file anywhere. The development bucket in MinIO exists (TOKI-003) but no code writes to it.
Four rules must hold on the server whatever the screen shows: a file of any type is accepted up to 100 MB and no larger; only people who can see the conversation can open its files; a file is always downloaded and never run in the browser; and a file that was uploaded but never sent does not stay in storage.

## Proposed outcome
A person who may post in a conversation can ask the server for permission to upload one file, send the bytes straight to storage (not through the app server), tell the server the upload is done, and then send a message that carries up to 10 such files. Storage itself refuses a file larger than the declared size, and the server checks the stored size again before the file counts as uploaded.
Opening a file goes through the server: it checks that the person can read the conversation of the message and answers with a short-lived signed address. The file always arrives as a download.
Deleting a message removes its files from Files and from storage. A file that nobody sent within 24 hours is removed from storage by a recurring job.

## Affected users and systems
- Members and Admins, who attach and open files in channels, direct messages and groups.
- The server app (`apps/server`): a new `files` module with its tables, routes, storage client and cleanup job; small changes to the send route of the `messages` module (the key `attachmentIds`, the text rule, the `files` key of the entry) and to the configuration and the harness.
- The shared package (`packages/shared`): the file limits, the request and response shapes, error codes, and the `files` key of `MessageEntry`.
- MinIO, the S3-compatible store (D-014): the development bucket of TOKI-003, and a separate test bucket.
- The neighbouring work: the composer upload cards (TOKI-059), thumbnails (TOKI-060), attachment cards and viewer (TOKI-062), the Files tab and page (TOKI-063), delete of a message (TOKI-047), the job queue (TOKI-064), the disk-space refusal (TOKI-103) and the production Compose (TOKI-084).

## Constraints
- Files live in MinIO, an S3-compatible store, with a limit of 100 MB each. Source: D-014, FR-10.
- A message carries up to 10 files. Source: D-042, FR-10.
- Every file type is accepted up to 100 MB; a file is always downloaded and never run in the browser. Source: D-095.
- No virus scanning in phase 1. Source: D-186.
- The size limit is held by the server even when the browser sends the file straight to storage. Source: AC-027, TS-043, technical design ("Uploading 100 MB straight to object storage from a browser, with the size enforced by the server").
- Files are uploaded and downloaded through short-lived signed addresses, bypassing Node. Source: technical design ("Files").
- Only people who can see the conversation can open its files; private conversations are visible to their members only, including through file lists and direct links. Source: AC-029, TS-045, BR-10, D-116, F18.
- A file uploaded but never sent is deleted from storage after 24 hours. Source: D-130 (an accepted assumption).
- Deleting a message removes its files from storage and from Files. Source: D-043, AC-033.
- Files of an archived channel stay for its members; a person who left no longer sees the channel's files. Source: D-170, D-116.
- Uploads are refused when the disk is 95% full, while messaging keeps working. Source: D-106 (the rule itself is TOKI-103's).
- Uploading is blocked while offline. Source: D-060 (the screen side is TOKI-059's).
- The development bucket exists already; this ticket does not create it. Source: Blueprint plan, TOKI-058 and TOKI-003 R27.
- Milestone M4, size L. Needs TOKI-036 (the plan) and, for the cleanup job and the send, TOKI-037 and TOKI-064. Source: Blueprint plan.

## Open questions
- Are any file types blocked, for example programs?
- Are uploaded files scanned for viruses?
- How does the server hold the size limit when the browser uploads straight to storage?
- Which S3 client library does the server use?
- How long does a signed address live?
- What happens to the stored file when its message is deleted?
- What does a person get who opens a file they may not see?
