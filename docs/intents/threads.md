# Intent: Threads
Author: Thanh Truong

## Problem
A conversation is one long list. A short exchange about one message ("Build 12 is ready" and three answers) fills the channel with lines that most members do not need, and a person who wants to answer one message has no way to do it without adding to the noise.
The message tables already hold replies (a `parent_id` and an `also_in_channel` column), and the message API sends and lists top-level messages only. Nothing sends a reply, lists the replies of one message, counts them, shows them, or tells the other members that a message has an answer.

## Proposed outcome
A member can answer one message in a thread. The thread opens in a side panel that shows the original message, the number of replies, the replies and its own box to write in. In a channel, a tick on "Also send to #name" also posts the reply as a normal message in the channel.
Under a message that has replies, the channel shows a line with the avatars of up to three people who replied, the number of replies and the time of the last one; pressing it opens the thread. Replies that were not also sent to the channel do not appear in the channel list and do not move the position of a direct message in the list.
Threads are one level deep: a reply has no thread of its own. A thread has its own address that reopens it, and the browser's Back button closes the panel before it leaves the conversation. If the original message is deleted, the thread stays, and a reply that was being written is still sent. The reply count and the last reply time are kept by the server and reach every open screen live.

## Affected users and systems
- Members and Admins, who reply, read threads and see the reply line under a message.
- The server (`apps/server`): the `messages` module gains the reply send, the list of one thread's replies and the stored reply summary; one new column group on `messages`; one new event kind.
- The shared package (`packages/shared`): the new keys of the message entry, the thread summary, the reply routes' shapes and the new event kind.
- `client-core`: the sync engine gains the thread windows and the reply send.
- The web app (`apps/web`): the thread route and panel, the reply box and the reply line.
- Neighbouring work: the sync engine (TOKI-040), the composer (TOKI-043), the message list and component (TOKI-041, TOKI-042), the action bar (TOKI-052), edit and delete (TOKI-047), pins, reactions, mentions, Activity (TOKI-065) and the read pointer (TOKI-053).

## Constraints
- A thread is one level deep, and a reply has no "Reply in thread" action. Source: FR-33, AC-087.
- "Also send to #name" is one message shown in both places: editing or deleting it changes both, and it counts in the channel as a normal message. Source: D-160.
- A reply sent without the tick is not a message of the conversation list and does not raise its unread count. Source: AC-085, AC-090, F14.
- When the original message is deleted the thread stays under a "Message deleted" line, and a reply being written is still sent. Source: D-013, D-096, AC-085.
- Every thread has its own address, and Back closes the panel first. Source: D-089.
- From 720 to 1099 px the thread panel overlays the chat; under 720 px it is the whole screen. Source: D-068.
- There is no "Unfollow thread" control in phase 1. Source: D-119.
- A message holds up to 10,000 characters; a repeat of a send stores one message; writing needs membership and an archived channel takes no new message. Source: D-042, D-111, D-077, BR-11 (as built in TOKI-037).
- Time is shown in 24 hours; every text goes through the translation package. Source: D-123, NFR-05.
- Milestone M3; size L. Needs TOKI-040. Source: Toki Blueprint, ticket TOKI-045.

## Open questions
- Is "Also send to #name" offered in a thread inside a direct message or a group?
- When a reply is deleted, does it leave the thread and the count?
- Where does the reply count live, and how does it reach other people's screens?
- How does the reply send reach the sync engine, which sends top-level messages only?
