# Parity check: picture of a difference design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/parity-diff-frame.md (Thanh Truong)
Ticket: TOKI-138

## Goal
The builder and the reviewer read the picture of a difference of the UI parity check to see what differs between the app and the prototype. Today it is drawn by `pixelmatch` in red on a faded copy of the image, and letters that lie on top of each other make it hard to read. After this change the picture is the picture of the app as it is, with a visible frame around each place that differs, so that the content stays readable and the reader sees where to look.

## Scope
- In: how the picture of a difference is drawn (R1 to R3); the numbers of the report staying as they are (R4); the notes in the README (R5); the tests (R6).
- Out (not now):
  - The rule that decides which pixels differ (`e2e/parity/limits.ts`), the ratio, the limit and the box around the different pixels.
  - The pictures of earlier kept runs in `docs/ui-parity/`: they stay as they were made.
  - A picture that puts the prototype and the app side by side, a slider, or a legend drawn into the picture.

## Requirements
- R1. For two images of the same size the picture of the difference has the size of the images and holds the pixels of the image of the app, unchanged, except the pixels of the frames (R2, R3). Check: a unit test in `e2e/support/parity.test.ts`: a pixel inside a frame and a pixel far from any frame are as in the image of the app.
- R2. The different pixels (those that `pixelmatch` finds by the rule of `limits.ts`) are put in groups: pixels that are 6 pixels or less apart, in the square sense, are in one group, and so are the pixels that a chain of such pairs joins. Each group has one frame, a rectangle that surrounds the pixels of the group and the 6 pixels around them. Check: unit tests: two different pixels 6 apart have one frame; two pixels farther apart have two.
- R3. A frame is drawn on the picture of the app only, 2 pixels thick, inside its rectangle, in violet `#7c3aed`. Check: a unit test finds the colour at the edge of a frame and finds the pixel next to the frame, outside it, as in the image of the app.
- R4. The ratio and the box that the report shows for a screen are the same as before for the same two images. Check: the existing tests of `compareImages` (the ratio, the box) pass unchanged.
- R5. A pair of images of different sizes still gives no picture of the difference (the row says that the sizes differ). Check: the existing test of `compareImages` for sizes that differ passes unchanged.
- R6. `e2e/parity/README.md` says that the picture of the difference is the picture of the app with a violet frame around each place that differs, and that a frame on an empty place means that the prototype draws something there that the app does not. Check: the file holds it.
- R7. The new functions have unit tests in `e2e/support/parity.test.ts`, and `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. Check: the commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request).

## Design
`compareImages(a, b)` in `e2e/support/parity.ts` calls `pixelmatch` and today writes its output as the picture. After this change it still calls `pixelmatch`, but only to find the different pixels (it paints each one in its diff colour, red, and the function reads those pixels to count them and to find the box, as it does today). The picture is made by a new function `frameDifferences(image, different)`:
1. grow the mask of different pixels by 6 pixels, in the square sense;
2. find the groups of the grown mask (4-connected) and the rectangle of each;
3. copy the image of the app and draw a 2-pixel frame, in violet, inside each rectangle.

The reader of the report sees, for a screen: the picture of the prototype, the picture of the app, and the picture of the difference (the app with frames).

### Layout
```
e2e/support/parity.ts          frameDifferences, used by compareImages
e2e/support/parity.test.ts     tests of R1 to R5
e2e/parity/README.md           R6
```

## Testing
- The tests of `frameDifferences` are written first and seen to fail: the pixels far from a frame stay as they were, a frame is violet at its edge, two close pixels make one frame and two far pixels make two.
- The existing tests of `compareImages` stay as they are (R4, R5).
- The check is run in the container on a screen that differs and the picture is looked at by eye, in Calm and in Focus; the pictures are in the pull request.

## Data safety
- The pictures hold only the prototype's invented data and the stubbed data of the check.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The rule that decides which pixels differ (`limits.ts`) does not change | Scope, Out; R4; the design still uses `pixelmatch` with `limits.ts` to find the pixels |
| The colour of the frame is not a colour of the app or of the prototype, and shows on the Calm and on the Focus background | R3 (violet; seen on both looks, Testing) |
| The picture has the same size as the two compared images | R1 |

## Open questions from the intent
- How close do two different pixels have to be to count as one place? Answered: 6 pixels or less (R2). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 1.
- Is the frame on the picture of the app only, or on the picture of the prototype as well? Answered: on the picture of the app only (R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.
- What colour, and how thick? Answered: violet `#7c3aed`, 2 pixels (R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 3.

## Areas of concern
1. The reach of a group. 6 pixels is the value that was tried on the sign-in page: a line of text is one frame, and the two edges of a button are one frame. Too small a value gives a frame for each letter; too large a value gives one frame around the whole card. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: 6 pixels. Owner: Thanh Truong.
2. The side of the frame. R3 puts it on the picture of the app only; the prototype's picture is next to it in the report. Drawing it on both would make the pictures easier to compare and the report larger. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: on the picture of the app only. Owner: Thanh Truong.
3. The colour and the thickness. R3 has violet `#7c3aed` and 2 pixels, which were seen on the Calm and the Focus picture of the sign-in page. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: violet `#7c3aed`, 2 pixels. Owner: Thanh Truong.
