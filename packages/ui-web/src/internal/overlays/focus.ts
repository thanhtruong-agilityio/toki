const CANDIDATES = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
].join(",");

function inDisabledFieldset(element: Element): boolean {
  let fieldset = element.parentElement?.closest("fieldset[disabled]") ?? null;
  while (fieldset) {
    const legend = Array.from(fieldset.children).find(
      (child) => child.tagName === "LEGEND",
    );
    if (!(legend && legend.contains(element))) return true;
    fieldset = fieldset.parentElement?.closest("fieldset[disabled]") ?? null;
  }
  return false;
}

function radioStop(radio: HTMLInputElement): boolean {
  if (!radio.name) return true;
  const scope = radio.form ?? radio.getRootNode();
  const group = Array.from(
    (scope as ParentNode).querySelectorAll<HTMLInputElement>(
      "input[type='radio']",
    ),
  ).filter((r) => r.name === radio.name && r.form === radio.form);
  const checked = group.find((r) => r.checked);
  return (checked ?? group[0]) === radio;
}

function isTabbable(element: HTMLElement): boolean {
  if (element.closest("[hidden],[inert]")) return false;
  if (element.matches(":disabled")) return false;
  if (inDisabledFieldset(element)) return false;

  const tabindex = element.getAttribute("tabindex");
  const index = tabindex === null ? NaN : parseInt(tabindex, 10);
  if (!Number.isNaN(index) && index < 0) return false;
  const hasIndex = !Number.isNaN(index);

  const tag = element.tagName;
  if (tag === "INPUT") {
    const input = element as HTMLInputElement;
    if (input.type === "hidden") return false;
    if (input.type === "radio") return radioStop(input);
    return true;
  }
  if (tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA") return true;
  if (tag === "A") return element.hasAttribute("href") || hasIndex;
  if (tag === "SUMMARY") {
    const details = element.parentElement;
    return (
      (details?.tagName === "DETAILS" &&
        details.firstElementChild === element) ||
      hasIndex
    );
  }
  if (tag === "AUDIO" || tag === "VIDEO")
    return element.hasAttribute("controls") || hasIndex;
  const editable = element.getAttribute("contenteditable");
  if (editable !== null && editable !== "false") return true;
  return hasIndex;
}

// The tabbable elements of a panel, in document order (R12).
export function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES)).filter(
    isTabbable,
  );
}

export function firstTabbable(root: HTMLElement): HTMLElement | null {
  return tabbables(root)[0] ?? null;
}

// jsdom ignores visibility in focus(), so the check is made here (R13, R22):
// the element is in the document and neither it nor an ancestor is
// `display: none` or `visibility: hidden`.
export function canFocus(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (getComputedStyle(element).visibility === "hidden") return false;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

// Moves focus when it can be given; says whether the element has it.
export function focusElement(element: HTMLElement | null | undefined): boolean {
  if (!element || !canFocus(element)) return false;
  element.focus();
  return document.activeElement === element;
}

// The element that has focus when a dialog opens, or null when focus is on the
// body (R13). It is a helper so that the order of R33 can be tested.
export function recordOpener(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body
    ? active
    : null;
}

// First focus of a dialog (R11): the element of the ref, else the first
// `data-autofocus`, else the first tabbable element, else the panel itself.
export function focusInto(
  panel: HTMLElement,
  initial: { current: HTMLElement | null } | null | undefined,
): void {
  const candidates = [
    initial?.current ?? null,
    panel.querySelector<HTMLElement>("[data-autofocus]"),
    firstTabbable(panel),
    panel,
  ];
  for (const candidate of candidates) {
    if (candidate && focusElement(candidate)) return;
  }
}
