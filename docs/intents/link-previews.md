# Intent: Link previews
Author: Thanh Truong

## Problem
A person who pastes a web address in a message gives the readers nothing but the address. They must open it to learn what it is. The journeys promise more: the address becomes a link, and a card with the title, the description and the site name appears under the message a few seconds later (F12, FR-37, AC-100). The sender can remove the card with its ×.
Nothing builds that card yet. The card needs the server to open the address, which is the one place where the app sends a request to a place chosen by a user. Done carelessly, a person could make the server read a service that only the server can reach (the database, the file store, the cloud metadata address, another machine on the company network) and show what it answered in a chat message. The technical design says it plainly: link previews refuse internal addresses.

## Proposed outcome
When a message that holds an http:// or https:// address is stored, a background job opens that address from the server, reads the page title, description and site name, and adds a card to the message. Everyone who can read the message sees the card appear, without a reload. The server opens only public addresses: it refuses internal and reserved addresses, whether they are written as an address or reached through a name, a redirect or a DNS answer that changes between the check and the connection. It stops reading after a fixed time and a fixed size, and a page that cannot be read gives no card and no error.
The sender can remove a card. The card then disappears for everybody and does not come back for that message.

## Affected users and systems
- Members and Admins who write and read messages in channels, direct messages and groups.
- The server app (`apps/server`): a new module that fetches and stores previews, one job on the background queue, one request to remove a card, and small additions to the message entry and to the event kinds.
- The worker process of the job queue (TOKI-064), which runs the fetch.
- The shared package (`packages/shared`): the preview shape on the message entry and its limits.
- The web app and `client-core`: the card under the message, the × on it, the event that adds or removes it.
- The neighbouring work: text formatting (TOKI-049), which gives the list of links of a text; attachment cards (TOKI-062), which owns the card's look, the place under the text and the seam that this work fills.

## Constraints
- Link previews are part of phase 1; the card shows title, description and site name. Source: D-014, F12, FR-37.
- Only http:// and https:// addresses are links. Source: D-167.
- Link previews refuse internal addresses. Source: Toki Blueprint, technical design ("Abuse limits").
- Slow work is queued; when the worker finishes, one more event updates the message. Source: technical design ("Background jobs", realtime).
- The sender can remove the card, and then neither the sender nor anyone else sees it while the link in the text stays. Source: F12, AC-100, TS-156.
- A message is never rendered as raw HTML; the server stores the text as sent. Source: technical design ("Abuse limits"), TOKI-037.
- Every text goes through the i18n catalogue; English is the default. Source: TOKI-017.
- One server for about 200 people on a single machine. Source: D-004, NFR-07.
- Milestone M4, size M. Needs TOKI-049 and TOKI-064. Source: Toki Blueprint, ticket TOKI-061.

## Open questions
- How many cards does one message get when it holds several addresses?
- What happens to the cards of a message when its text is edited?
- Are addresses in direct messages and private channels fetched too?
- Which addresses count as internal, and how are redirects and DNS tricks handled?
- Does the card show an image?
- Who may remove a card?
- Which ticket draws the card and which one gives it its place?
- What is the Vietnamese wording of the button that removes a card?
