# Intent: Search inside a conversation
Author: Thanh Truong

## Problem
A person who remembers a word from a conversation, or who remembers who wrote something there, has no way to find it except by scrolling. A conversation can hold thousands of messages and the message list loads them in windows, so what is on the screen is only a small part of what exists. Ctrl+K searches every conversation the person belongs to; it is the wrong tool when the person already knows the conversation and wants only its messages.
The prototype has a small answer: a magnifier in the conversation's header opens a search field under the tab row, and the list keeps only the messages that contain the typed text or were sent by someone whose name matches. That works in the prototype because it holds every message in memory. The real list does not, so the filter has to be done by the server, and it has to keep the promises of the global search: Vietnamese typed without diacritics finds the text with them, and a person finds only what they are allowed to read.
The journey F19 adds a step the prototype does not have: a result can be pressed, search closes, and the list shows that message and flashes it.

## Proposed outcome
The header of a conversation gets the magnifier button. Pressing it opens a search field under the tab row; typing asks the server for the messages of this conversation that contain the words or were sent by a person whose name matches, and the results are shown under the field. Pressing a result closes the search and shows the message in the list. A cross or Esc closes the search. When nothing matches, the area says so in words written for this search.
The server answers one new request, for one conversation, built on the Vietnamese index and on the first search API. It returns nothing a person could not read through the history of that conversation, and the answer for a conversation the person may not read is the same as for one that does not exist.

## Affected users and systems
- Every Member and Admin who has a conversation open. A Guest is a phase 5 role (D-090, D-152) and is not built here.
- The web app (`apps/web`): the header of a conversation (TOKI-035), the Messages tab and the page that holds it (TOKI-041), and the result rows. The `api` client of `packages/client-core` gets one method.
- The server (`apps/server`): one route in the `search` module (TOKI-070) and one read in the `messages` module that finds the messages of one conversation by their author.
- The shared package (`packages/shared`): the shapes of the request and the answer.
- The Vietnamese index (TOKI-069), the search API (TOKI-070), the message API (TOKI-037) and the permission functions (TOKI-027), which this work reads.
- The tickets next to it: the command palette (TOKI-071), which searches every conversation, and the jump to a message with its flash (TOKI-068).

## Constraints
- A search field appears under the tab row when the magnifier is pressed; it keeps the messages that contain the words or were sent by someone whose name matches; typing without diacritics finds text with them; a result closes the search and shows the message; a cross or Esc closes it; no result says "No messages match". Source: flow F19, prototype `chatHtml` and `msgsHtml`.
- Vietnamese typed without diacritics matches, and permissions are respected. Source: D-015.
- Only a member reads a conversation's messages: a private channel or a direct message of other people is never searched or confirmed, an Admin included; a public channel that was not joined has no readable content. Source: D-047, D-051, D-116, BR-10.
- A deleted message is not returned. An archived channel's history stays searchable; a deactivated person's old messages stay. Source: D-013, D-049, F26, F41.
- Every search or filter has an empty state written for its context. Source: D-074.
- Server modules reach each other's data through public interfaces only; routes under `/api/v1`, one error format, permission checked on the server. Source: technical design, D-125, BR-09.
- Every text goes through i18n with English as the default; a wording the prototype does not contain is a proposal. Source: NFR-05, D-139.
- Search over 1 million messages answers in under 200 ms (p95) with 200 people online. Source: D-113, NFR-13; the part that depends on the index is TOKI-069 R11.
- Nothing works by hover alone. Source: D-067.
- Milestone M4, size S. Needs TOKI-070. Source: Toki Blueprint, ticket TOKI-072.

## Open questions
- Does the search filter the message list in place, as the prototype does, or show a list of results under the field? The journey says "press a result" and the prototype has no result to press.
- What does the field match: the text, the sender's name, both? With which rule for the name?
- From how many characters does it search, and how many results does it show at once?
- In which order are the results, and how does a person ask for more?
- Are the replies of threads in the results? The prototype leaves them out.
- Does the search ask the global search API with a filter, or does it have its own request?
- Does an archived channel's page have the search?
- Does a text match inside a word, as the prototype does, or from the start of a word?
- How does a result open: in the list, and what of a reply that is not in the list?
