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
     // calendar, meet, tasks, people, admin, prefs
     prototypeSteps: [{ click: '[data-action="tab"][data-id="files"]' }], // to the state, on the prototype
     appRoute: "/files",
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

A difference that the reviewer accepts goes in `known-differences.ts`: the row name, the reason, and
the ticket that will fix it (or `accepted`). The report then lists it as `known`, and lists an
entry that no longer matches a real difference as "no longer a difference: remove the entry".

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
