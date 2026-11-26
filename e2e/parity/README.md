# UI parity check

Compares the built app with the prototype and writes a report of where they differ (TOKI-109).
It checks the design values (every token, in Calm and Focus, 4 accents, 3 densities) and the
screens that a ticket declares (Calm and Focus at 1280, 900 and 390 px wide). The prototype is the
fixed copy `e2e/prototype/index.html`; its hash is in `prototype.sha256`.

## Run it

```bash
pnpm test:e2e:parity            # the whole check
pnpm test:e2e:parity screens.spec.ts   # one file
```

It needs **Docker** and runs only inside the Playwright container for `linux/arm64` (the same
Chromium and fonts on your machine and in CI). The first run pulls the image (about 4.6 GB on disk)
and installs the dependencies; later runs reuse `~/.cache/toki-parity`. Outside the container it
stops with a message. The report is `e2e/assets/parity/report.md` (and `report.json`), with the
images of each difference in `e2e/assets/parity/images/`. CI runs it as the job `ui parity` and
puts the report in the job summary.

## Read the report

The first line counts the rows: `match`, `differs` (new), `known`, `no longer a difference`,
`not run`. Each difference is one row with a name that is the same on every run:

- a token: `--accent calm/indigo/own` with the prototype's value and the app's value;
- a screen: `admin/calm/wide` with the ratio of different pixels, the limit, the box
  `[left, top, right, bottom]` around the different pixels, and three images (the reference, the
  app, the difference).

**A difference does not fail the run.** Read the report; a part that is wrong becomes a ticket to
fix that part, named by the row. The run fails only where no result can be given: a missing
reference image, a step that cannot be done on the prototype, a changed prototype copy, a run
outside the container.

## Add a screen (a ticket that builds a screen)

1. Add a file `e2e/parity/screens/<name>.ts` that exports one or more declarations. It is picked
   up with no other edit.

   ```ts
   import type { ScreenDecl } from "../../support/parity";

   export const files: ScreenDecl = {
     id: "files", // the name of the rows and of the images
     section: "files", // a key of the prototype's HASH: home, activity, later, files, mail,
     // calendar, meet, tasks, people, admin, prefs; or `guest`, its guest sign-in card
     prototypeSteps: [{ click: '[data-action="tab"][data-id="files"]' }], // to the state, on the prototype
     appRoute: "/files",
     appRoot: ".app", // the element of the app that is captured; default `.app`, the app shell
     appSteps: [{ click: "text=Files" }], // to the same state, in the app
     ready: ".members-table", // a selector of the app that is visible once the screen has its content;
     // without it the check waits for the network to be idle
     mask: [".avatar"], // selectors painted over on both sides (counts and times are masked already)
     looks: ["calm"], // default: both
     widths: ["wide"], // default: wide, mid, narrow
     seed: false, // true: needs the seeded database; listed, not run here
     setup: async (page) => {}, // stub the API before the app opens
   };
   ```

2. Make the reference images from the prototype: `pnpm ui:reference files`. It writes
   `e2e/parity/reference/<id>-<look>-<width>-chromium-linux.png`, lists each file, and keeps an
   image that exists unless you add `--update` (then it fails, so that an image is never replaced by
   chance). Never make a reference from the app.
3. Run `pnpm test:e2e:parity` and read the report.
4. In the pull request, say which images you added or replaced and why, and what the report shows.

### A page outside the app shell

The check takes the picture of `.app` on the side of the app, and `.app` is drawn only by the shell of
the signed-in app. A page outside the shell, such as the sign-in page, names the element that it
draws into: `appRoot: "#root"`. The side of the prototype is not changed: it is always `#app`.
`e2e/parity/screens/signin.ts` is the example. Its prototype side is the guest sign-in card of the
prototype (`section: "guest"`, the hash `#guest`), the email step and then the code step
(`prototypeSteps`); on the app side it stubs the calls of `/api/v1/auth/` and goes through the same
steps (`appSteps`). A step that clicks a field of the next step waits for it, so the picture is of
that step and not of the one before.

A difference that the reviewer accepts goes in `known-differences.ts`: the row name, the reason, and
the ticket that will fix it (or `accepted`). The report then lists it as `known`, and lists an
entry that no longer matches a real difference as "no longer a difference: remove the entry".

## Keep the results

The report and the images of a run are written to `e2e/assets/parity`, which git ignores. To keep a
run in the repository, run `pnpm ui:save` by hand. It runs the check, then copies the report and all
the images into `docs/ui-parity/<UTC date>-<commit>/` with a `meta.json` (commit, branch, date,
whether the tree had uncommitted changes, the counts), and makes `docs/ui-parity/index.md` again
from the folders, newest first. Then you commit the folder in a pull request.

- `--no-run` keeps the report that is already there instead of running the check. It records
  `ran: false` in `meta.json` and prints the age of the report, but not its date.
- `--no-images` keeps the report and `meta.json` without the images.
- `--update` replaces a kept run of the same date and commit; without it the command refuses.
- `pnpm ui:save --prune <n>` prints the `git rm -r` command for each run older than the newest `n`
  and deletes nothing.

`pnpm ui:save` deletes the last report of `e2e/assets/parity` before it runs the check, so that a
failed run leaves no report to keep by mistake. A run that gives no result keeps nothing. A tree with
uncommitted changes is kept, with `-dirty` at the end of the folder name and a warning. Git stores
identical files once, so a run of an unchanged app adds almost nothing to the history.

## What it does not prove

Pixel equality; hover, active and focus states; Safari and Firefox; states the prototype does not
draw; text drawn on another machine than the container. A change smaller than the limit
(`limits.ts`, a ratio of 0.02 to start) is not expected to show in an image; the token check and the
review by eye cover it.

## If the prototype changes

Every run compares the file with `prototype.sha256` and fails with "the prototype changed: make the
references again and record the new hash". Copy the new file to `e2e/prototype/index.html`, record its
hash (`shasum -a 256 e2e/prototype/index.html`), run `pnpm ui:reference --all --update`, and say so
in the pull request.
