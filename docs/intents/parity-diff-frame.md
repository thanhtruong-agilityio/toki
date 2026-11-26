# Intent: Make the image of a difference easy to read
Author: Thanh Truong

## Problem
For each screen that differs, the UI parity check writes three pictures: the prototype, the app, and the difference. The picture of the difference is drawn by the comparison library with red for every different pixel on a faded copy of the image. A person who reads it sees red outlines of letters that lie on top of each other, so it is hard to tell what is different and which side drew it. Two other ways of drawing it were tried (blue and orange for each side, and an amber wash over the changed areas) and were no easier to read.
Source: the images of the run of the UI parity check on the sign-in page (2026-11-26); `e2e/support/parity.ts` (the comparison).

## Proposed outcome
- The picture of the difference is the picture of the app as it is, with a visible frame around each place that differs, so that the content stays readable and the reader sees where to look.
- Pixels that are close to each other are one place and have one frame, so a line of text is one frame and not one for each letter.
- The numbers of the report (the ratio of different pixels and the box around them) do not change.
- The README of the check says what the frames mean.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder and the reviewer who read the report of the check, in the job summary and in the kept runs of `docs/ui-parity/`.
- Systems: the comparison of the UI parity check (`e2e/support/parity.ts`, its test `e2e/support/parity.test.ts`) and `e2e/parity/README.md`.

## Constraints
- The rule that decides which pixels differ (`limits.ts`) does not change.
- The colour of the frame is not a colour of the app or of the prototype, and shows on the Calm and on the Focus background.
- The picture has the same size as the two compared images.
Source: `docs/specs/2026-11-24-ui-parity-check-design.md` (R9, R11).

## Open questions
- How close do two different pixels have to be to count as one place? Too small gives many frames, too large one frame around the whole card.
- Is the frame on the picture of the app only, or on the picture of the prototype as well?
- What colour, and how thick? The frame has to be seen on a white and on a dark background.
