# TOKI-106 Run Toki locally with one command

Spec: docs/specs/2026-11-23-local-run-one-command-design.md
Intent: docs/intents/local-run-one-command.md
Tier: M

## Design
The spec holds the requirements (R1 to R18) and the behavior. This section only settles how the scripts are built.

### Files
- `scripts/lib.sh`: gets the shared helpers below. The two new scripts source it like `up.sh` does.
- `scripts/env-pull.sh`: `pnpm env:pull`.
- `scripts/start-local.sh`: `pnpm start:local`.
- `scripts/local-run.test.sh`: the test, run with `bash scripts/local-run.test.sh`. Like `scripts/smoke.test.sh` it is not part of `pnpm test`; the README says how to run it.
- `package.json`: two scripts, `env:pull` and `start:local`.
- `README.md`: quick start and commands (R18).

### New helpers in `lib.sh`
- `node_env_refusal ENV_FILE`: reads `NODE_ENV` in the shell and in the file, each on its own, with `env_file_get`. Returns 1 and prints which source said what when either is set to anything but `development` (an empty value counts as set). Unset in both is allowed. It is separate from `guard_development`, which keeps refusing on unset (R17).
- `port_listeners PORT`: process ids listening on a TCP port, through `lsof`.
- `run_file`: path of this worktree's run file, `${XDG_STATE_HOME:-$HOME/.local/state}/toki/local-run/<cksum of the repository path>.pid`.
- `is_own_listener PID`: true when the run file names a live process and PID is that process or one of its descendants (walk `ps -A -o pid=,ppid=`).

### `env:pull` order
1. Refuse on `NODE_ENV` (R17, the shell and an existing `.env`).
2. Check `doppler` is installed (`command -v`) and logged in (`doppler me`), else the sentence of R7.
3. With `umask 077`, call `doppler secrets download -p toki -c dev --no-file --format env` into a temporary file next to `.env`. Its error text is never shown; the failure class (no network, no access, no config, unknown) is chosen from the text and a fixed sentence is printed (R7, R16).
4. Check the temporary file: not empty (R2), every required name present and non-empty (R6), `NODE_ENV` allowed (R17). On failure delete it and stop with `.env` untouched.
5. If `.env` exists: same values -> say so and stop; different -> print the differing names, ask once, replace on `y`, keep on anything else, exit 1 when there is no terminal (R5).
6. Move the temporary file over `.env` (a broken link or a link is replaced by a regular file, R3). Mode 600 comes from the umask (R4). A trap removes the temporary file on every exit.

The required names are a fixed list at the top of the script. The test reads the Required column of `docs/environment-config.md` and fails when the two differ or a name is missing from `.env.example` (R6).

### `start:local` order
1. Checks of R8 in one pass: Node major 22, `pnpm` equal to `packageManager` in `package.json`, Docker running, and `doppler` installed and logged in only when `.env` is missing. All problems are printed together; nothing starts.
2. Own run already going (run file + listeners, R13): print the address and exit 0.
3. `.env` present: use it, no network (R9). Missing: run `env:pull` and stop with its message on failure (R10).
4. `NODE_ENV` check (R17). Port checks for the server port (from `SERVER_PORT` in `.env`, default 3000) and the web port 5173: a listener that is not this worktree's own run stops the command and names the port, the process name and the pid (R12).
5. `pnpm dev:up`, then `pnpm --filter @toki/server db:migrate`, then `pnpm dev` in the background; each failure prints the step name and stops (R11). No reset and no `dev:down`.
6. Write the run file, install a trap on `INT`, `TERM` and `EXIT` that kills the whole process tree of `pnpm dev`, removes the run file and leaves the services up (R15).
7. Poll `http://127.0.0.1:<web port>/healthz` through the web proxy until it answers or the `pnpm dev` process has ended; print the addresses (R14) and wait in the foreground.

### How the test works
`local-run.test.sh` builds a temporary repository: copies `scripts/`, a small `package.json` and `.env.example`, and puts a folder of fake commands first on `PATH`: `doppler`, `docker`, `node`, `pnpm`, `curl`, `lsof`. Each fake records its calls in a log and behaves as the case says (fail, return a recognisable fake value, answer after the fake `pnpm dev` ran). Ownership cases use real `sleep` processes so the process-tree walk is real. `XDG_STATE_HOME` and `HOME` point into the temporary folder. The prompt of R5 reads standard input; for the tests only, `TOKI_ASSUME_TTY=1` makes the script treat standard input as a terminal, and the no-terminal case leaves it out. Fake data only; the real Docker, `.env` and network are never touched.

## AC -> step -> test
| Req | Step | Test case |
|---|---|---|
| R1 | env-pull step 3, 6 | fake doppler returns 3 pairs; `.env` has exactly those lines |
| R2 | step 3, 4, 6 | doppler fails / returns nothing / leaves out a required name / `NODE_ENV=production`: old `.env` byte-for-byte, exit non-zero |
| R3 | step 6 | `.env` as a broken link and as a link to a file end as a regular file |
| R4 | umask in step 3 | mode of the file is 600 |
| R5 | step 5 | same -> no change; different + `y` -> replaced; `n` -> kept, exit 0; no terminal -> kept, exit 1; names only, no value |
| R6 | step 4 | missing and empty required name listed by name; `.env` unchanged; list equals the inventory |
| R7 | steps 2, 3 | one case per sentence: no doppler, not logged in, no access, no config, no network |
| R8 | start-local step 1 | fake node 20; no docker; no doppler with `.env` missing; several at once -> one message, nothing started |
| R9 | step 3 | `.env` present: the doppler call log is empty |
| R10 | step 3 | `.env` missing: env:pull runs; its failure stops the command |
| R11 | step 5 | call log order `dev:up`, migrate, `dev`; failing docker stops before migrate; no reset or `dev:down` in the log |
| R12 | step 4 | foreign `sleep` holds the web port: stop, port and pid named, process not killed; another worktree's run file does not count as own |
| R13 | step 2 | live run file + listener is the process or its child: prints address, exit 0, nothing started |
| R14 | step 7 | output holds `http://localhost:5173`, the Mailpit address and `FIRST_ADMIN_EMAIL` (name only) |
| R15 | step 6 | SIGINT: no `pnpm dev` process left, run file removed, containers not stopped (call log) |
| R16 | all | a recognisable fake value appears in no output and no call-log line |
| R17 | helper, both scripts | production in the shell, in `.env`, in the pulled file: nothing written or started; unset with no `.env`: env:pull runs; unset in both: start:local goes on |
| R18 | README | text check: both commands present, no step that copies a `.env` between folders |

## What can break, and the riskiest step
- **The process-tree kill on Ctrl+C (step 6) is the riskiest part.** `pnpm dev` starts `pnpm -r`, which starts `vite` and `tsx watch`; killing only the first leaves orphans on ports 3000 and 5173. The test checks that no process of the fake tree remains; the by-hand run at the end checks the real tree and that the ports are free again.
- Real Doppler error text is not known exactly, so the failure class is a best guess. An unknown text falls to a safe generic sentence that points at `doppler secrets -p toki -c dev`; nothing is replaced in either case.
- `lsof` differs a little between macOS and Linux; the script uses only `-nP -iTCP:<port> -sTCP:LISTEN -t`, which both support.
- `.env` values with quotes or several lines: the existing readers (`env_file_get`, `env_file_is_simple`) are reused and a multi-line `.env` is refused with the existing wording.
- A stale run file after a crash: the process is dead, so it is ignored and replaced (spec R12).

## Steps
1. Test harness and fakes in `scripts/local-run.test.sh`, with the R17 cases first; see them fail.
2. Helpers in `lib.sh`.
3. `env-pull.sh` until its cases pass.
4. `start-local.sh` until its cases pass.
5. `package.json` scripts, README (R18).
6. Run `shellcheck` if installed, the whole test, `pnpm lint` and `pnpm format:check`.
7. By hand, in the Terminal: a clean worktree with a real Doppler login, ending at the sign-in page.
