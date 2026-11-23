# Intent: Search API
Author: Thanh Truong

## Problem
Ctrl+K has to find conversations, people and messages, and a person who types Vietnamese without diacritics has to find the words with them: "nguyen" must find "Nguyễn" and "duong dan" must find "đường dẫn". The database can already answer "which messages contain these words" (TOKI-069), but no request exists that a screen can call, and nothing yet decides who may be found.
The permission rule is the part that cannot be wrong. A word that was written only in a private channel must never lead a person who is not in it to that channel or to a message of it, an Admin included. A conversation that was never joined shows no message. A person whose account was deactivated is not listed. The search has to give the same answer to everyone who has the same access, and it must never confirm that something exists.
The palette and the search inside a conversation need one answer shape: the first 20 of each kind, and a way to ask for more.

## Proposed outcome
The server answers one request, `GET /api/v1/search`, with the first 20 conversations, the first 20 public channels the person could join, the first 20 people and the first 20 messages that match the typed text, each kind with a way to ask for the next 20.
Conversations and people match whatever the case and the diacritics of the name and of the typed text. Messages come from the Vietnamese index of TOKI-069 and only from the conversations the person belongs to, with no preview of any other conversation. A private channel or a direct message the person is not in never appears, and a deactivated person is not listed.
The request shows nothing the person could not read through another request, and the answer for a refused case is the same as for a case with no result.

## Affected users and systems
- Everyone who uses Ctrl+K, once the palette (TOKI-071) is built: nothing on screen changes with this ticket.
- The server app (`apps/server`): a new `search` module with the route; one read added to the `conversations` module and one to the `messages` module.
- The shared package (`packages/shared`): the request and response shapes, the limits and the rule that orders names.
- The Vietnamese search index (TOKI-069), the message API (TOKI-037), the conversation and direct message APIs (TOKI-029, TOKI-030), the member list (TOKI-031) and the permission functions (TOKI-027), which this work reads.
- The tickets that follow: the command palette (TOKI-071), the search inside a conversation (TOKI-072) and the access-control test suite (TOKI-088).

## Constraints
- Ctrl+K searches conversations, people, messages and actions; Vietnamese typed without diacritics matches. Actions are the palette's own list and not a server matter. Source: D-015, D-112, FR-31.
- 20 results per kind, more on request. Source: D-112.
- Messages are searched only in conversations the person belongs to, from 2 characters. Source: flow F29, D-116.
- A private channel, and a message of one, is never returned to a person who is not in it; an Admin has no extra reach into private channels or direct messages. Source: D-051, D-047, AC-083.
- A channel that is not joined shows no message, only its name and topic. Source: D-116 (no message), F29 (name and topic).
- A deactivated person is not listed; their old messages stay and their direct messages stay readable. Source: F41, D-091.
- A message that was deleted is not returned. Source: D-013, D-049; TOKI-069 R2.
- No access is answered like not found, and a search result never confirms what the person may not see. Source: BR-10, TS-129.
- Search over 1 million messages answers in under 200 ms (p95) with 200 people online. Source: D-113, NFR-13; the part that depends on the index is TOKI-069 R11.
- Server modules reach each other's data through public interfaces only. Source: technical design, boundary rules.
- Routes under `/api/v1`, one error format, permission checked on the server. Source: D-125, BR-09.
- Milestone M4, size M. Needs TOKI-069. Source: Toki Blueprint, ticket TOKI-070.

## Open questions
- Which fields of a conversation and of a person does the typed text match: the name only, or also a channel's topic and a person's job title?
- In which order are conversations, channels and people listed, and which of them make the first 20?
- Does a person see the public channels they have not joined in Ctrl+K, and what of them?
- Are the archived channels the person belongs to in the results?
- Is the signed-in person listed among the people?
- What does a message result carry, and how is more asked for?
- Which rule matches a typed text to a message, in which order are the messages listed, and what is the time for a very common short prefix? (TOKI-069 concerns 4, 5 and 11.)
