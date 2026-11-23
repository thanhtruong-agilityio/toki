import { useEffect, useRef, useState } from "react";

// A little before the sentinel is reached, so the next page is asked early (TOKI-025 R9).
const ROOT_MARGIN = "0px 0px 48px 0px";

// The nearest ancestor that scrolls. A root margin does not reach past an intermediate scrolling
// container when `root` is null, which is why the scroller is passed (R9). The shell's
// `SectionPage` body is one, found without a reference to it.
function scrollingAncestor(element: Element): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

// Returns the ref callback of the sentinel element placed after the last row. `onMore` is called when
// the sentinel comes into view. `watch` is what the list holds (for example the number of rows): when
// it changes the observer is made again, because an observer tells only of a change and a sentinel
// that is still in view after a page was added would otherwise never ask for the next one.
export function useLoadMore(
  onMore: () => void,
  { enabled = true, watch }: { enabled?: boolean; watch?: unknown } = {},
): (element: Element | null) => void {
  const [sentinel, setSentinel] = useState<Element | null>(null);
  const latest = useRef(onMore);
  useEffect(() => {
    latest.current = onMore;
  });
  useEffect(() => {
    if (!enabled || sentinel === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current();
      },
      { root: scrollingAncestor(sentinel), rootMargin: ROOT_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, enabled, watch]);
  return setSentinel;
}
