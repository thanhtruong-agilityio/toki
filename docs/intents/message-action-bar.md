# Intent: Message action bar
Author: Thanh Truong

## Problem
After the message component (TOKI-042) a message is drawn in full, but a person can do nothing to it. Reactions, threads, edit, delete and pins each give a piece of that (the picker, the thread panel, the edit field and its confirmation, the pin request), and none of them has a button a person can press: the message has a place for an action bar, and the bar is empty.
The prototype shows a small bar over the top right corner of a message when the pointer is on it, with a smile button, a Reply in thread button and a More button, and a menu behind More. A hover bar is not enough: no feature may be hover-only, so a person on a phone or a tablet needs the same actions by touch, and a person with a keyboard needs them without a pointer. Copying a message's text needs the device clipboard, which the app reaches only through the platform package, and that package has no clipboard yet.

## Proposed outcome
Every message of a conversation and of a thread panel has an action bar. On a desktop it appears over the message on hover or when focus is in the message; on a narrow screen (under 720 px) and on any screen that cannot hover, a tap on the message shows it directly under the message, never over the text, and a second tap hides it. A person with a keyboard focuses the message and reaches the same buttons with Tab and the arrow keys.
The bar has the smile button (it opens the reaction picker of TOKI-046), Reply in thread (a root message of the main list only), and More. The More menu has Copy text, Pin to conversation or Unpin, and, for the author, Edit and Delete, and, for an Admin who is a member, Delete on another person's message; a person sees only the actions the permission functions allow. Copy text puts the message text on the clipboard and shows "Copied text". Later work that adds a button or a menu entry (Save for Later, Remind me about this) adds one entry in one file.

## Affected users and systems
- Every Member and Admin who reads a conversation or a thread, on a desktop, a tablet or a phone.
- The web app (`apps/web`): a new folder for the bar and its menu, one entry in the message extensions of TOKI-042, the texts of both languages in `packages/i18n`.
- The platform package (`packages/platform`): a clipboard member, with its web implementation.
- The work whose actions the bar hosts: reactions (TOKI-046), edit and delete (TOKI-047), pins (TOKI-048), threads (TOKI-045); the message component (TOKI-042) and the list (TOKI-041).

## Constraints
- No feature may be hover-only or desktop-only; every action has an entry point on narrow and touch screens. Source: D-067, NFR-02.
- On a screen narrower than 720 px, tapping a message shows its action bar directly under the message, never over the text; every control is at least 40 px tall. Source: F38.
- Hover on a desktop; on narrow screens, tap the message to show the action bar. Source: F14 (the Reply in thread button and the tap), F38.
- Every icon-only button has a name for screen readers; menus work with arrow keys. Source: D-075, NFR-03.
- A reply inside a thread has no "Reply in thread" action, in the bar or in the More menu. Source: AC-087, TS-136.
- Reactions work in a conversation that is not archived by a member; a person sees the actions the permission functions allow. Source: D-077, F26, TOKI-027.
- Pin and unpin are in the More menu of a message. Source: FR-36, AC-096.
- When the connection drops, every action other than sending is blocked with an explanation, never a false success. Source: D-079.
- Components reach the device's features only through the platform package. Source: technical design, TOKI-018.
- Every text goes through i18n and English is the default; every wording the prototype does not contain is a proposal. Source: NFR-05, D-139.
- Milestone M3, size M. Needs TOKI-042. Source: Toki Blueprint, ticket TOKI-052.

## Open questions
- What does a message that is waiting to send, or that failed to send, offer in the bar?
- Where is the active message kept on a narrow screen, and when does it stop being active?
- How does a person with a keyboard reach the bar?
- How are the bar and the menu shown on a touch screen wider than 720 px?
- Where do Save for Later, Remind me about this and the later "Turn into task" go, so that they are added without editing the bar?
- Through what does Copy text reach the clipboard, and what does it copy?
