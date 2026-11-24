# Intent: Run Toki locally with one command
Author: Thanh Truong (lead).

## Problem
To see Toki running on a machine, the builder today does four things by hand: put a filled-in `.env` in the repository root, start the backing services, apply the database migrations, and start the server and the web app. Each step has its own command, and the first one is the weak spot.

The `.env` is a plain file in one folder. The repository is worked on through many worktrees, and each worktree needs its own copy. In practice the builder copies the file from one worktree to the next, and it goes missing or loses values: a copied link points at a file that no longer exists, a fresh copy of `.env.example` has every secret empty, and the server then stops with a missing-value error. A second person joining the project has no way to get the values at all, except by being sent them.

The result is that "run it and look at it" costs time and breaks often, for the builder and even more for anyone new.

## Proposed outcome
- A builder with access to the project's shared development values can get a complete `.env` in any worktree with one command, at any time, and again after the file is lost or damaged.
- The values live in one place that both builders can read and one of them can change. Changing a value there reaches every worktree the next time the command is run. No value is sent by chat, mail or copied between folders.
- A builder can start the whole development setup with one command: it checks that the tools it needs are present, gets the `.env` when it is missing, starts the backing services, applies the migrations, starts the server and the web app, and ends by printing the address to open and how to sign in.
- A builder without access, or without the tools, is told what is missing and what to do, in plain words, before anything is started.
- Running the command again on a machine that is already running changes nothing and breaks nothing.
- The values stay out of git, out of the printed output and out of the logs.

## Affected users and systems
- The builder (one person building with Claude) and the second builder who has joined the project.
- Any later builder or reviewer who needs to see Toki running.
- The root `.env`, the development services (Postgres, MinIO, Mailpit), the server and the web app.
- The README quick start and the installation documents, which describe how to run Toki.

## Constraints
- The shared development values are kept in the Doppler project `toki`, config `dev`. Decided by Thanh Truong on 2026-11-23, because a free plan covers two people and the values can be read back from the command line. This holds throwaway local values only, never a production secret.
- Secrets live in `.env` and never in git. Source: intent `environment-config`.
- The services come from the local development setup of intent `local-dev-environment`; this intent does not change what they are or how they reset.
- The names and meaning of every variable stay as in the environment inventory (TOKI-096); this intent changes how the values get to the machine, not which values exist.
- Node 22 and pnpm as pinned by the repository; the command must work for someone who has the default Node of a machine that differs from it, by saying so clearly.
- A worktree must still run with a `.env` it already has, with no network and no Doppler account, so that a builder who is offline or has no access is not blocked.
- The command must not overwrite a `.env` the builder has edited by hand without saying so first.
- The ports of the development setup are fixed; if another worktree already uses them, the command stops and says which one is busy instead of killing it.
- Two builders may run on one machine's Docker at the same time; one builder's run must not reset the other's data.

## Open questions
1. Who may change the shared values on Doppler, and who is only allowed to read them? Not answered.
2. When the `.env` already exists and differs from Doppler, does the command keep it, ask, or replace it? Not answered.
3. Should the one command also apply the migrations on every run, or only when the database is new or behind? Not answered.
4. Does the one command run in the foreground and stop with Ctrl+C, or does it start the processes in the background and give a separate stop command? Not answered.
5. What does a builder without a Doppler account do on day one: wait for an invitation, or use the example file with values they make up? Not answered.
6. Should the sign-in step be shortened for a local run, for example by printing the first admin's sign-in link, or is reading the code in Mailpit enough? Not answered.
7. Does this work belong to the foundation milestone (M1) or to a later one, and does it replace the wording "Commands: TBD" of the README quick start? Not answered.
