# Intent: Vietnamese search index
Author: Thanh Truong

## Problem
Ctrl+K has to find messages, and Vietnamese has to match when it is typed without diacritics: "ha noi" must find "Hà Nội", "dat" must find "Đạt", and "tieng viet" must find "tiếng Việt". The messages table holds the text, but nothing in the database can answer "which messages contain these words" quickly, and a plain `LIKE` over a million messages would read every row.
The match has to ignore case and the marks of Vietnamese (the tone marks, the hats and horns, and the letter đ), whichever way the text was typed (a letter with its mark in one character or in two). It must not find a message that was deleted, it must stay right when a message is edited, and it must not slow the send of a message.
Three tickets use it (the search API, the command palette and the search inside a conversation), so the rule that folds the text has to be one rule, written once, and used for the stored text and for the text typed in the search field alike.

## Proposed outcome
The `messages` table gains one column that holds the searchable words of the message, with case and diacritics removed, and a GIN index over it. The database keeps the column right by itself: it is computed from the text of the row, so a send, an edit and a delete cannot forget it, and a deleted message or a system line has no searchable words.
No extension is installed: the fold uses functions that Postgres has built in, the same steps the members list already uses.
`packages/shared` gets the one function that turns what a person typed into the query for the column. The server gets one function that returns the ids of the messages that match, newest first, in the conversations it is given, in pages. The search API and the palette build on it and add the permission rule, the grouping and the screens.
A test with Vietnamese fixtures proves the cases above, with the text stored in both forms of Unicode, and a plan test proves the index is used.

## Affected users and systems
- Everyone who uses Ctrl+K or the search inside a conversation, once the tickets that follow are built: nothing on screen changes with this ticket.
- The server app (`apps/server`): the `messages` module (one new column, one index, one read function) and one migration.
- The shared package (`packages/shared`): the function that builds the query and the words of a text.
- The messages table (TOKI-036), the message API that writes it (TOKI-037) and the edit and delete (TOKI-047), which change the text.
- Later tickets that use it: the search API (TOKI-070), the command palette (TOKI-071) and the search inside a conversation (TOKI-072).

## Constraints
- Full-text search in Postgres, ignoring Vietnamese diacritics; no separate search engine. Source: D-015; Toki Blueprint, technical design ("Postgres for everything").
- Search over 1 million messages answers in under 200 ms (p95), with 200 people online. Source: D-113, NFR-13 of the requirements.
- A message deleted by its author or by an Admin is shown as "Message deleted" and its text is gone, so it must not be found. Source: D-013, D-049; TOKI-047 R7.
- The history of an archived channel stays searchable. Source: Blueprint context, "archive a channel" (the history stays readable and searchable).
- Messages are searched only in conversations the person belongs to, and a private channel is never returned to an outsider; messages are searched from 2 characters, 20 results per kind and more on request. Source: D-116, D-051, D-112; flow F29. These rules belong to the search API; this ticket gives it a function that takes the conversations it may search.
- The table of messages has one migration per ticket that changes it, and the test of its columns allows the later columns. Source: TOKI-019 convention 8; TOKI-036 concern 7.
- Sending a message stays fast: nothing slow may be added to the send transaction. Source: NFR-13; TOKI-036 constraints.
- Server modules reach each other's data through public interfaces only. Source: technical design, boundary rules; `.claude/rules/server.md`.
- One folding rule for the whole product: Unicode form NFD, the combining marks U+0300 to U+036F removed, `đ` and `Đ` turned into `d`, lower case. Source: TOKI-032 R19 (`foldSearchText`), TOKI-033 concern 6, member management R24.
- Needs TOKI-036 and TOKI-037; needed by TOKI-070, TOKI-071 and TOKI-072. Milestone M4, size M. Source: plan, ticket list.

## Open questions
- Which Postgres extension does the fold need, and is it present in the development and CI images?
- Is the column computed by the database, by a trigger or by the server code, and who keeps it right when a message is edited or deleted?
- Which text is indexed: the stored text, the names of mentions, deleted messages, system lines?
- Does a word typed in part ("tie") find the whole word ("tiếng"), and does a part inside a word find it?
- In which order are the messages of a search listed?
