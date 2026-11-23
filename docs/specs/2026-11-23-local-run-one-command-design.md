# Local run with one command design

Date: 2026-11-23 · Status: draft for review
Intent: docs/intents/local-run-one-command.md (Thanh Truong, lead)
Ticket: TOKI-106

## Goal
A builder needs to see Toki running on a machine without doing four manual steps, and without carrying a `.env` file from one worktree to the next.
This work gives the builder two commands: one that puts a complete `.env` in the current worktree from the shared development values, and one that starts the whole development setup and prints the address to open.
A second builder, or a new worktree, gets to a running web app by running the same commands, with no value sent by chat.

## Scope
- In: `pnpm env:pull`, which writes the root `.env` from the Doppler project `toki`, config `dev`; `pnpm start:local`, which checks the tools, gets the `.env` when it is missing, starts the services, applies the migrations, starts the server and the web app, and prints the address and the sign-in hint; the messages for every missing tool or access; a script-level test with a fake `doppler`, `docker` and `pnpm`; the README quick start and the commands list.
- Out (not now):
  - The list of variables and `.env.example`: they stay as they are. This work changes how values reach the machine, not which values exist.
  - Starting, stopping and resetting the services: `dev:up`, `dev:down` and the reset scripts stay as they are. `start:local` calls `dev:up` and never calls a reset.
  - Production: no production value goes to Doppler through this work, and the commands refuse to run when the environment name is `production`.
  - Creating the Doppler account, project and invitations: done by a person on the Doppler site, once; the README says how.
  - Sample data (`dev:seed`) and a shortened sign-in flow: not part of this work (concern 6).
  - Running on Windows: not covered; the scripts are Bash, like the existing ones.
  - Doppler or any other service as a dependency of CI or of the production deploy.

## Requirements
- R1. `pnpm env:pull` writes the file `.env` in the repository root with the values of the Doppler project `toki`, config `dev`. Check: with a fake `doppler` that returns three names and values, the file holds exactly those three lines.
- R2. `env:pull` never leaves a half-written or empty `.env`. It writes to a temporary file in the same folder and moves it over `.env` only when the Doppler call succeeded and returned at least one value. Check: with a fake `doppler` that fails, or that returns nothing, an existing `.env` is byte-for-byte unchanged and the command exits non-zero.
- R3. `env:pull` replaces a `.env` that is a broken symbolic link, and a `.env` that is a link to a readable file is replaced by a regular file. Check: a worktree whose `.env` is a link to a missing file ends with a regular, non-empty `.env`.
- R4. The pulled `.env` can be read only by its owner (mode 600). Check: the mode of the file after a pull.
- R5. When a `.env` already exists, `env:pull` first compares it with the pulled values by name and value. When they are the same it says so and changes nothing. When they differ it prints the names of the variables that differ, never a value, and asks once, in the terminal, whether to replace the file. On a yes it replaces the file (R2, R3). On a no, or on any other answer, it keeps the file and exits 0. When it has no terminal to ask in, it keeps the file, says to run the command in a terminal, and exits 1. Check: with the answer `y` the file equals the pulled values; with `n` it is unchanged; with no terminal it is unchanged and the exit code is 1; in all three cases no value is printed.
- R6. After a pull, `env:pull` checks that every variable name in `.env.example` that is marked required in the inventory is present and non-empty. It prints the names that are missing and exits non-zero. It prints no value.
- R7. `env:pull` reports, in one plain sentence each, these cases and exits non-zero without touching `.env`: `doppler` is not installed; the user is not logged in; the user has no access to the project `toki`; the config `dev` does not exist; there is no network. Each sentence says what to do next. Check: one test case per sentence, with a fake `doppler` that fails in that way.
- R8. `pnpm start:local` checks, before it starts anything: Node is version 22 and the `pnpm` pinned by the repository is available; Docker is installed and running; `doppler` is installed and logged in, but only when a `.env` has to be pulled. It prints every missing item in one message, with what to do, and starts nothing. Check: with a fake `node` of another major version, nothing is started and the message names Node 22.
- R9. `start:local` uses an existing `.env` as it is and makes no network call when one exists (rule of concern 2 aside). Check: with a `.env` present and a fake `doppler` that records its calls, the record is empty.
- R10. When `.env` is missing, `start:local` runs `env:pull` first and stops, with that command's message, when it fails.
- R11. `start:local` then runs, in order: `pnpm dev:up`; the database migrations; the server and the web app together. It stops at the first step that fails, says which one, and does not start the next. It never runs `dev:down` or any reset script. Check: with a fake `docker` that fails, the migration and the dev servers are never started.
- R12. Before it starts the server and the web app, `start:local` checks that the server port and the web port are free. When one is used by a process that is not this worktree's own dev run, it stops and names the port and the process, and does not stop that process. Check: a listener on the web port makes the command stop and name port 5173.
- R13. When this worktree's own server and web app are already running, `start:local` does not start a second pair; it prints the address and exits 0. Check: running the command twice leaves one server process and one web process.
- R14. When the web app answers on its port, `start:local` prints the address `http://localhost:5173`, the address of the mail catcher, and the sentence that the sign-in code arrives in the mail catcher. It prints the name of the variable that holds the first admin's email (`FIRST_ADMIN_EMAIL`), not its value.
- R15. Stopping the command with Ctrl+C stops the server and the web app it started and leaves the services running; the message says how to stop the services (`pnpm dev:down`). Check: after the interrupt no server or web process of this worktree remains, and the Docker containers are still up. The foreground or background form is decided in concern 4.
- R16. Neither command prints, logs or puts on a command line any value from `.env` or from Doppler. Shell tracing is off in both scripts. Check: with a fake `doppler` that returns a recognisable value, the value appears in no output of either command.
- R17. Both commands refuse to run when the environment name is `production` or is set to any value other than `development`, with the same rule and wording as the reset scripts. Check: with the name set to `production`, nothing is written and nothing is started.
- R18. The README quick start describes the two commands in place of the manual steps and of the line "Commands: TBD" for running the apps; it says how to get access to Doppler once and how to work without it (concern 5). Check: the README holds both commands and no step that tells the builder to copy a `.env` from another folder.

## Design
### Layout
```
scripts/
  env-pull.sh          pnpm env:pull
  start-local.sh       pnpm start:local
  lib.sh               existing helpers; new ones are added here (checks, port test, refusal in production)
  local-run.test.sh    the script-level test, with a fake doppler, docker and pnpm on PATH
package.json           two new scripts: env:pull, start:local
README.md              quick start and commands
```

### `env:pull`
1. Refuse when the environment name is not `development`.
2. Check `doppler` is installed and logged in.
3. Call `doppler secrets download --no-file --format env` for the project `toki` and the config `dev`, with the output going only to a temporary file next to `.env`, created with mode 600.
4. When the call fails or the file has no value, delete the temporary file, print the sentence of R7 and stop.
5. Compare with an existing `.env` by name and value, ask once when they differ (R5). Replace by moving the temporary file over `.env` (R2, R3).
6. Check the required names (R6) and print the result.

The project and config names are fixed constants at the top of the script; changing them is a one-line edit.

### `start:local`
1. The checks of R8, in one pass.
2. Get the `.env` (R9, R10).
3. `pnpm dev:up`; the migrations; then the server and the web app together, with the output of both on the terminal.
4. The port checks of R12 happen before step 3 starts the processes; the already-running check of R13 happens first.
5. Wait for the web app to answer, print R14, stay in the foreground until Ctrl+C (concern 4).

### Errors
- Missing tool, no login, no access, no network, missing config, missing names -> a plain sentence, exit 1, nothing changed (R7, R8).
- A step of `start:local` fails -> its own output, then one line naming the step, exit 1 (R11).
- A port is busy -> the port and the process are named, exit 1 (R12).
- The environment name is not `development` -> refusal, exit 1 (R17).

## Testing
- A script-level test, `scripts/local-run.test.sh`, in the style of `scripts/smoke.test.sh`: it puts a fake `doppler`, `docker`, `node` and `pnpm` first on `PATH` and works in a temporary copy of the scripts. Fake data only; it never touches the real Docker, the real `.env` or the network.
- One case per requirement R1 to R17: success, empty result, failing result, broken link, mode 600, same and different `.env`, each message of R7, each check of R8, existing `.env` with no call, order and stop of R11, busy port, second run, printed address, interrupt, no value in the output, production refusal.
- The README check (R18) is a text check in the same test: both commands are present and the manual copy step is not.
- Not tested here, checked by hand once before merge: a real run on a clean worktree with a real Doppler login, ending at the sign-in page.

## Data safety
- The values in Doppler are throwaway development values; no production secret is stored there or pulled by these commands (R17).
- Both builders may change the values (concern 1), so a wrong edit reaches both `.env` files at the next pull. The free plan keeps the activity log for 3 days only (concern 8), so a change older than that cannot be traced; the README says to tell the other builder when a value is changed.
- The temporary file has mode 600 from its creation and is removed on every exit path, including an interrupt.
- No value is printed, logged or passed on a command line (R16); a difference between two files is reported by name only (R5).
- `.env` stays ignored by git; this work adds nothing that could commit it.
- The fake values in the test are invented strings, not copies of any real value.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The shared development values are kept in the Doppler project `toki`, config `dev` (decided 2026-11-23); throwaway local values only | R1, the fixed names in the design, R17 |
| Secrets live in `.env` and never in git | R4, R16, Data safety (no change to the git ignore rules) |
| The services come from the local development setup; this work does not change them or how they reset | R11 (calls `dev:up`, never a reset or `dev:down`), Scope Out |
| Variable names and meaning stay as in the inventory; only how values reach the machine changes | Scope Out; R6 reads the names from `.env.example` and does not add any |
| Node 22 and pnpm as pinned; a machine with another default Node is told so clearly | R8 |
| A worktree must still run with a `.env` it already has, with no network and no Doppler account | R9 |
| The command must not overwrite a hand-edited `.env` without saying so first | R5 (names the differing variables and asks first), concern 2 |
| Ports are fixed; a busy port stops the command and names the owner, without killing it | R12 |
| Two builders may share one machine's Docker; one run must not reset the other's data | R11 (no reset, no `dev:down`), R13, R15 (Ctrl+C leaves the services up) |

## Open questions from the intent
- Who may change the shared values on Doppler, and who may only read them? Answered: both builders may change them. See concern 1.
- When `.env` exists and differs from Doppler, does the command keep it, ask, or replace it? Answered: it asks once and replaces on a yes. See concern 2 and R5.
- Should the one command apply the migrations on every run, or only when the database is new or behind? Answered: on every run. See concern 3 and R11.
- Foreground with Ctrl+C, or background with a separate stop command? Answered: foreground with Ctrl+C. See concern 4 and R15.
- What does a builder without a Doppler account do on day one? Answered: waits for the invitation and meanwhile uses `.env.example`. See concern 5 and R18.
- Should the sign-in step be shortened for a local run, or is reading the code in the mail catcher enough? Answered: reading the code in the mail catcher is enough. See concern 6 and R14.
- Which milestone, and does the work replace the wording "Commands: TBD" of the README? Answered: M1, and it replaces the wording. See concern 7 and R18.

## Areas of concern
1. Who may change the shared values on Doppler. Decided: both builders may change them. The lead had proposed write access for the lead only, to keep a wrong edit from reaching the other builder's `.env`; the decision is to accept that risk and to say in the README that a changed value is told to the other builder (see Data safety). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
2. What `env:pull` does when `.env` exists and differs from Doppler. Decided: it prints the differing names, asks once in the terminal, and replaces the file on a yes (R5). Added to the decision: with no terminal to ask in, it keeps the file and exits 1, because it must not replace a file without asking; Thanh Truong may change this when the spec is reviewed. `start:local` never asks and never pulls over an existing `.env` (R9). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
3. Whether migrations run on every `start:local`. Decided: on every run. The migration command already reports "Migrations applied" and is safe to run again, and a builder who pulled a newer branch is never behind (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
4. Foreground or background. Decided: foreground, stopped with Ctrl+C, as the existing `pnpm dev` already works (R15). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
5. The first day of a builder who has no Doppler access yet. Decided: the README tells the builder to wait for the invitation and meanwhile to copy `.env.example` to `.env` and fill the empty values with throwaway ones, as today; `start:local` then works because R9 uses an existing `.env` (R18). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
6. Shortening the sign-in step. Decided: left out of this work; the sign-in code arrives in the mail catcher and R14 says where. A printed sign-in link would need a server-side change and is separate work. Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
7. Milestone and README wording. Decided: the work belongs with the foundation milestone (M1), whose exit check includes "pnpm dev runs", and it replaces the README line "Commands: TBD" for running the apps (R18). Decided by Thanh Truong (lead, as product owner) on 2026-11-23. Owner: Thanh Truong.
8. The limits of the free Doppler plan. Answered: the Developer plan is free for 3 users, and each further user costs $8 a month, so two builders fit. The comparison table on the same page lists a user limit of 25 and 10 projects, 4 environments and activity-log retention of 3 days; the 3 and the 25 do not agree on the page, and the plan is read as 3 free users, the lower number. The log retention is why Data safety asks the builders to tell each other about a change. Evidence: https://www.doppler.com/pricing, read on 2026-11-23. Owner: Thanh Truong.
