// Sets `inert` and `aria-hidden` on the page behind an opaque dialog (R15) and
// gives them back. A counter per element makes two opaque dialogs restore
// correctly. An element with `data-layer-skip` and every element that contains
// one are left alone; the walk goes through each such container (R34).
// `inert` is read and written as an attribute: jsdom has no property for it.
type Saved = { count: number; inert: string | null; ariaHidden: string | null };

const saved = new WeakMap<Element, Saved>();

function take(element: Element): void {
  const entry = saved.get(element);
  if (entry) {
    entry.count += 1;
  } else {
    saved.set(element, {
      count: 1,
      inert: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    });
  }
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
}

function give(element: Element): void {
  const entry = saved.get(element);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  saved.delete(element);
  if (entry.inert === null) element.removeAttribute("inert");
  else element.setAttribute("inert", entry.inert);
  if (entry.ariaHidden === null) element.removeAttribute("aria-hidden");
  else element.setAttribute("aria-hidden", entry.ariaHidden);
}

function walk(
  container: Element,
  own: Element,
  keep: readonly Element[],
  taken: Element[],
): void {
  for (const child of Array.from(container.children)) {
    if (child === own) continue;
    if (child.hasAttribute("data-layer-skip")) continue;
    // A layer above the dialog (a Menu opened from it) stays interactive; so
    // does every element that contains one (R15, R28).
    if (keep.includes(child)) continue;
    if (
      child.querySelector("[data-layer-skip]") ||
      keep.some((node) => child.contains(node))
    )
      walk(child, own, keep, taken);
    else {
      take(child);
      taken.push(child);
    }
  }
}

// `keep` holds the nodes of the layers above the dialog, which are left alone.
export function isolate(
  own: Element,
  keep: readonly Element[] = [],
): () => void {
  const taken: Element[] = [];
  walk(document.body, own, keep, taken);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const element of taken) give(element);
  };
}
