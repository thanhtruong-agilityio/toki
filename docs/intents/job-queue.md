# Intent: Background job queue
Author: Thanh Truong

## Problem
Several features of Toki must do work that does not belong in a request: clear a status at the time the person chose, make a thumbnail of an uploaded image, fetch the title of a link, send a reminder at its time, end Pause or Focus on time, remove old data. Today the server has nowhere to keep such work, nothing that runs it later, and nothing that tries again when it fails. The merged specs already wait for this: the mail layer makes one attempt and leaves retries to the queue, the invitation state is worked out at read time "because no job exists before M4", and the pruning of old events runs on a timer inside the server only because no queue exists.
Without this work, each of the tickets that need a timer or a slow task would invent its own timer and its own retry.
Source: Toki Blueprint, ticket TOKI-064; technical design ("Background jobs"); specs TOKI-021 (concern 5), TOKI-024 (R18), TOKI-036 (concern 11).

## Proposed outcome
The server has one job queue on Postgres, and a worker process that runs the jobs. A module that needs background work declares a job (its name and the shape of its data), adds a job to the queue (also inside the database transaction that makes the change it belongs to), and writes one handler that the worker runs. A job that fails is tried again later with growing waits; a job that cannot succeed is kept where an operator can see it. A job can be set to start at a time, and a recurring job can run on a schedule. The worker stops cleanly when the server is told to stop. Event pruning moves from a timer inside the server to the first scheduled job.

## Affected users and systems
- No person sees this work directly. People see its effects through the tickets that use it: status that clears on a timer (TOKI-056), thumbnails (TOKI-060), link previews (TOKI-061), reminders (TOKI-067), Pause and Focus (TOKI-076).
- The server app (`apps/server`): a new `jobs` module, a second entry point for the worker, one more step in `db:migrate`, one more command.
- The Postgres database: one more schema, owned by the queue library.
- The operator of an installation: reads the worker's log and the queue status command; the production image and Compose (TOKI-084) run the worker as a second service.
- The test harness (TOKI-008): a helper that gives a test a database with the queue schema, and the controllable clock.

## Constraints
- The queue is pg-boss on Postgres; there is no Redis and no other queue. Source: Toki Blueprint, technical design (stack; "Postgres for everything").
- The backend is one modular monolith in Node 22; the worker is a separate process that uses the same database, beside the app that serves the API and WebSocket. Source: Toki Blueprint, technical design (high-level architecture, "Infrastructure and deployment").
- One server, up to about 200 people. Source: D-009, NFR-04.
- The queue holds the jobs the technical design lists: thumbnails, link previews, mail, Web Push, reminders, snooze returns, status expiry, ending Pause and Focus, pruning old data. Source: Toki Blueprint, technical design.
- A failed job is retried. Source: Toki Blueprint, ticket TOKI-064 ("retries on failure").
- Backend work is written test-first; timers in tests use the controllable clock of TOKI-008, not real waiting. Source: TOKI-008 R19.
- Migrations are forward-only and applied by command, not at server start. Source: TOKI-005 (R11, concern 4).
- Messages and mail are never written to a log or error output. Source: TOKI-021 (R13), TOKI-036 (Data safety).
- The server starts and answers `/healthz` while Postgres is unreachable. Source: TOKI-004 R20.
- Milestone M4, size M. Needs TOKI-005 (database and migrations). Source: Toki Blueprint, ticket TOKI-064.

## Open questions
- Does the worker run inside the server process or as its own process?
- Who creates the queue library's own database schema, and how does a test get it?
- How many times, and with what waits, is a failed job tried again?
- Does the job queue take over the pruning of old events from TOKI-036?
- Can a job that carries a one-time code (sign-in or invitation mail) be queued? (TOKI-021, concern 5.)
- How exactly does a job that starts at a given time keep its time, and how does it stop when the reason for it is gone?
- How does an operator see that jobs are failing?
