let locks = 0;
let before = "";

// The first lock stores `body.style.overflow` and sets `hidden`; the last
// unlock restores it (R14).
export function lockScroll(): void {
  if (locks === 0) {
    before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
}

export function unlockScroll(): void {
  if (locks === 0) return;
  locks -= 1;
  if (locks === 0) document.body.style.overflow = before;
}
