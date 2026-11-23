# Intent: Text formatting
Author: Thanh Truong

## Problem
A message is stored and sent as plain text, and the message component (TOKI-042) draws that text exactly as it is. A person who writes `*Friday*`, `_wait_` or `` `npm test` `` sees the marks, not bold, italic or code. A web address is plain text that cannot be pressed. The composer has no buttons for the three marks, although the journeys list them.
Text typed by people is also the main way an attacker could run script in another person's browser, so the way the text is drawn has to be safe by construction, not by filtering.

## Proposed outcome
A message shows text between two `*` as bold, between two `_` as italic and between two backticks as code, without the marks; an address that starts with `http://` or `https://` is a link that opens in a new tab. Everything else, HTML included, is shown character for character. The composer has Bold, Italic and Code buttons that wrap the selected text in its mark. The text is stored exactly as typed; the formatting is made when the message is drawn, so every device and every later feature reads the same plain string.
The rules that find marks and addresses are one pure function that the web app draws from and the link previews of a later ticket read from, so they cannot disagree about what is a link.

## Affected users and systems
- Every Member and Admin who writes or reads a message, in a conversation and in a thread.
- The web app (`apps/web`): the text pipeline of the message component (TOKI-042) and the toolbar of the composer (TOKI-043).
- `packages/shared` (the rule that reads marks and addresses), `packages/ui-web` (the link) and `packages/i18n` (the names of the three buttons).
- The mention chip (TOKI-050) and the link previews (TOKI-061), which read the same text.

## Constraints
- Text between two `*` is bold, between two `_` italic, between two backticks code; the marks are not shown; the toolbar wraps the selection in them. Source: FR-37, AC-099, TS-154, TS-155, F12.
- Only `http://` and `https://` addresses become links, opened in a new tab; there is no multi-line code block in phase 1. Source: D-167.
- HTML typed in a message is shown as the characters typed, also inside a mark; no element is created, no image loads and no script runs. Source: FR-37, AC-101, TS-157, TS-158, technical design (abuse limits).
- The text is stored as sent and returned as data; the server never builds markup from it. Source: TOKI-037 R4 and Data safety.
- A message holds up to 10,000 characters, counted in code points. Source: D-042, TOKI-037 concern 9.
- Every text goes through i18n and English is the default. Source: NFR-05, D-018.
- Every wording in quotes that the prototype does not contain is a proposal. Source: D-139.
- Link previews (the card and its ×) are a separate ticket. Source: plan, TOKI-061.
- Milestone M3; size M. Needs TOKI-042. Source: Toki Blueprint, ticket TOKI-049.

## Open questions
- Which marks exist, how are they written, and may they nest?
- Which addresses become links, how far does an address reach, and how does a link open?
- Is the formatting made when the text is stored or when it is drawn?
- What happens to a mention inside bold, italic or code?
- Where do the three toolbar buttons go and what do they do to the selection?
- Which other places that show a message text show the marks?
