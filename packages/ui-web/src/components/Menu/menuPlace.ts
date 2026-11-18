export type Rect = { left: number; top: number; right: number; bottom: number };

export const menuAligns = ["end", "start"] as const;
export type MenuAlign = (typeof menuAligns)[number];

// The prototype's `posMenu` (R23): below the anchor, its right edge (`end`) or
// its left edge (`start`) on the anchor's, above when it does not fit, and 8 px
// from the edges of the window.
export function computeMenuPosition({
  anchor,
  menu,
  viewport,
  align,
}: {
  anchor: Rect;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  align: MenuAlign;
}): { left: number; top: number } {
  let left = align === "end" ? anchor.right - menu.width : anchor.left;
  let top = anchor.bottom + 4;
  if (top + menu.height > viewport.height - 8) {
    top = Math.max(8, anchor.top - menu.height - 4);
  }
  left = Math.max(8, Math.min(left, viewport.width - menu.width - 8));
  return { left, top };
}
