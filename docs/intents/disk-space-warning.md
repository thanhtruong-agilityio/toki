# Intent: Disk-space warning and upload refusal
Author: Thanh Truong

## Problem
Toki keeps every uploaded file on the disk of the one server that runs it, and the product has no storage quota. If nobody notices that the disk is filling, the disk becomes full and the whole server fails: the database cannot write, and messaging stops with the uploads. Admins need an early sign that space is running out, and the server needs a way to stop taking new files before the disk is full, so that people can still talk while an Admin frees space.
Source: Toki Blueprint, decision D-106, requirement NFR-15, ticket TOKI-103.

## Proposed outcome
- When the disk is 80% full or more, an Admin sees a warning at the top of the Admin page. At 95% or more the warning says that uploads are refused.
- At 95% or more the server refuses every new upload with a clear reason; people can still send, edit and read messages, and files that were already uploaded can still be sent and downloaded.
- The warning follows the disk: it goes away on its own once space is freed.
- A Member never sees disk figures; a Member whose upload is refused sees the reason.
Source: D-106, D-191 (proposal), requirement NFR-15, journey F39 ("When the disk is 80% full, Admins see a warning here").

## Affected users and systems
- Users: Admins, who read the warning and free space; every person who uploads a file, who may be refused.
- Systems: `apps/server` (a new module that measures the disk, one read route, the refusal, the configuration variable), `packages/shared` (the response shape and the error code), `apps/web` (the notice region of the Admin page), `packages/i18n` (the texts), `docs/environment-config.md` and `.env.example` (one new variable).

## Constraints
- No quota. The only limits are the two disk levels: warning at 80%, refusal at 95%. Source: D-106, NFR-15.
- Messaging keeps working while uploads are refused. Source: D-106.
- Only an Admin sees the warning; the server refuses the disk figures to a Member. Source: D-090, F39.
- The refusal gives the reason. Source: D-106.
- A Member who is refused is told why in the interface; every text goes through i18n and English is the default. Source: D-106, project rule.
- The disk can only be filled for real on a test machine; the checks must run without a real disk. Source: NFR-15 ("Fill a test disk to 80% and to 95%"), the test harness of TOKI-008.
- Routes under `/api/v1`, one error format and one registry of error codes. Source: D-125.
- Milestone M4, size S; the plan line has no dependency, and the work builds on merged tickets only (the spec's Plan changes list them; TOKI-058 needs this ticket). Source: Toki Blueprint, ticket TOKI-103.

## Open questions
- Which disk is measured: the volume that holds the files or the one that holds the database? (D-191 is open and proposes the volume that stores files.)
- Is the warning shown anywhere besides the Admin page?
- How often does the Admin page look at the disk, and does the server keep a measurement or take a new one each time?
- What status and error code does a refused upload get, and what does it cover (starting an upload, sending a message that carries files, thumbnails)?
- What happens when the server cannot read the disk at all?
- Does the 95% rule count the size of the file being uploaded?
