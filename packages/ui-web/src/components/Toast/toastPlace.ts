// How long a toast stays (R23). There is no `duration` prop: the rule is here.
// 5 seconds with a button, D-069; 2.8 seconds without one, the prototype's.
export const TOAST_MS_WITH_ACTION = 5000;
export const TOAST_MS_PLAIN = 2800;

// At most this many toasts show at once; a new one removes the oldest (R25).
export const TOAST_MAX = 3;

// Where the toasts stand (R27, R31). Plain functions, so a table test can
// check them without a browser.

// px from the bottom of the window with nothing to avoid (R27), and above the keyboard (R34)
export const TOAST_BOTTOM = 20;
const ABOVE_OBSTACLE = 14; // px between the toasts and what they stay above
const WIDTH_MAX = 480;
const WIDTH_SHARE = 0.92;

export type ToastObstacle = { top: number; left: number; right: number };
export type ToastSpan = { left: number; right: number };

// The distance from the bottom of the window to the bottom of the toasts.
export function computeToastBottom(
  viewportHeight: number,
  obstacles: ToastObstacle[],
  extent?: ToastSpan,
): number {
  let bottom = TOAST_BOTTOM;
  for (const { top, left, right } of obstacles) {
    if (![top, left, right].every(Number.isFinite)) continue;
    if (right <= left || top >= viewportHeight) continue;
    if (extent) {
      const overlap =
        Math.min(right, extent.right) - Math.max(left, extent.left);
      if (!(overlap > 0)) continue;
    }
    bottom = Math.max(bottom, viewportHeight - top + ABOVE_OBSTACLE);
  }
  return bottom;
}

// The horizontal box of the region: as wide as the prototype's min(480px,92%)
// of the anchor (or of the window), centred on the anchor (or the window).
export function computeToastExtent(
  viewportWidth: number,
  anchor?: ToastSpan,
): { left: number; width: number } {
  const anchorWidth = anchor ? anchor.right - anchor.left : viewportWidth;
  const centre = anchor ? (anchor.left + anchor.right) / 2 : viewportWidth / 2;
  const width = Math.min(WIDTH_MAX, WIDTH_SHARE * anchorWidth);
  return { left: centre - width / 2, width };
}
