# TOKI-138 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** The picture of a difference of the UI parity check is the picture of the app with a magenta frame (`#ff00ff`, 2 pixels) around each group of different pixels.

**Spec:** docs/specs/2026-11-26-parity-diff-frame-design.md (tier S, no design stage)

A first draft of the code exists, uncommitted, in the worktree `toki-135` (violet, and a grouping that merges pixels up to 13 apart). It is not used: R2 asks for 6, and R3 for magenta.

## AC -> step -> test
| Requirement | Step | Test |
|---|---|---|
| R1 picture is the app, same size, only the frames changed | 1 | `frameDifferences`: a pixel inside a frame and a pixel far from any frame are as in the app |
| R2 groups of pixels 6 or less apart | 1 | `groupDifferences`: 6 apart one group, 7 apart two, a chain of 6s one, diagonal 6/6 one, 6/7 two |
| R3 magenta, 2 pixels, inside the rectangle, app picture only | 1 | colour at the edge, the pixel next to the frame and the pixel 2 inside are as in the app; clipping at the image edge |
| R4 ratio and box unchanged | 1 | the existing `compareImages` tests pass unchanged |
| R5 sizes differ gives no picture | 1 | the existing test passes unchanged |
| R6 README | 2 | the file holds the wording |
| R7 unit tests and commands pass | 1, 3 | format, lint, typecheck, test |

## Steps
1. **`frameDifferences`** (files: `e2e/support/parity.ts`, `e2e/support/parity.test.ts`). Tests first, seen to fail: `groupDifferences(different, w, h)` returns the rectangles (grid of 7 x 7 cells, union-find, groups numbered by the first different pixel in reading order, rectangle = bounding box grown by 6 and clipped), and `frameDifferences(image, different)` draws the 2-pixel magenta frames on a copy of the image. `compareImages` keeps pixelmatch (default colours) to find the pixels, the ratio and the box, and makes its picture with `frameDifferences`.
2. **README** (file: `e2e/parity/README.md`). Say what the frames mean, with the wording of R6, in "Read the report".
3. **Check** (no files). Run the check in the container and look at the pictures by eye in Calm and Focus (the sign-in rows, now on `main`, and the admin rows); then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Risks
- Cost of the grouping on a picture where most pixels differ (the admin rows: about 14% of 1 MP): the grid keeps each pixel to the 9 cells around it; the check runs in the time it has today.
- The pictures of earlier kept runs in `docs/ui-parity/` are not changed.
