// The not-found view of TOKI-006: the root route's fallback, the page of a channel that is not
// found (R21 (b)) and the route's direct draw use this one markup. TOKI-082 replaces its body.
export function NotFoundView() {
  return <p>Page not found</p>;
}
