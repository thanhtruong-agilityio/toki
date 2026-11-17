# Intent: DM and group DM API

Author: Thanh Truong

## Problem

A Member or an Admin has no way to start a conversation with one other person, or with a few people, outside a channel. The tables that hold direct messages and groups will exist after TOKI-028, but nothing opens them: no request takes a set of people, finds the conversation that already belongs to that set or makes it, and answers the caller.
The rules of these conversations are easy to get wrong in application code: the same set of people must always lead to the same conversation, also when two of them start it at the same moment; a group holds at most 8 people counting its creator; nobody is added or removed afterwards; nobody messages themselves; a guest has no direct messages. Without one request that holds these rules, the screens, the message API and the bootstrap call would each have to decide them.

## Proposed outcome

The server offers one request that opens a direct message or a group direct message. Afterwards:

- A Member or an Admin sends the people they want to talk to and gets back the conversation: the existing one when the same set of people has one, a new one otherwise.
- One person gives a direct message; two to seven people give a group, so a group has 8 people at most, counting the person who starts it.
- The same set of people always leads to the same conversation, whoever starts it and in whatever order the people are given, also when two requests arrive together.
- A group never gains or loses people, and nobody can open a conversation with themselves.
- A guest cannot open a direct message, and a deactivated person cannot be put into a new one.
- The refusals have stable error codes that the screens can turn into their messages.

## Affected users and systems

- Members and Admins, who start direct messages and groups from the plus on "Direct messages". Source: Toki Blueprint, flow F25, FR-22.
- The conversations module of the server (`apps/server`), its tables from TOKI-028, and a small read of accounts in the members module. Source: Toki Blueprint, technical design.
- Later work that builds on it: the people picker (TOKI-034), the bootstrap call (TOKI-031), the conversation list (TOKI-033) and the message API (TOKI-037). Source: Toki Blueprint, Needs column.
- Guests (phase 5): refused by the same request. Source: Toki Blueprint, D-050.

## Constraints

- Part of milestone M2 (accounts and conversations). Size M. Needs TOKI-028. Source: Toki Blueprint, ticket TOKI-030.
- A group holds up to 8 people counting its creator; people cannot be added to or removed from a group (D-017, D-045, D-086, BR-36). Source: Toki Blueprint, FR-22.
- The same set of people always leads to the same conversation; messaging yourself is not supported in phase 1 (F25). Source: Toki Blueprint, flow F25.
- Every Member and Admin may start direct messages and groups; guests may not (BR-37, D-050, D-090). Source: Toki Blueprint, FR-22, AC-059.
- Permission is checked on the server for every request; private conversations and direct messages are visible to members only (BR-09, D-077). Source: Toki Blueprint, business rules.
- A deactivated person is not listed; an existing direct message with them keeps its history (F25, F41, D-094). Source: Toki Blueprint, flows.
- The tables, their database rules and the key of a direct message come from TOKI-028 and are not changed here. Source: Toki Blueprint, ticket TOKI-028.
- Errors use the one format of TOKI-004; the status codes follow D-131. Source: Toki Blueprint, D-131.
- Server modules never read each other's tables. Source: Toki Blueprint, technical design.
- English is the default interface language; the server sends codes and English developer messages and the screens translate. Source: Toki Blueprint, D-018.

## Open questions

- Can a new direct message or group be opened with a person who is deactivated? Source: flows F25 and F41 say such a person is not listed and that direct messages with them become read-only; they do not say what the server answers to a request that names one.
- When one member of a group is deactivated, does the whole group become read-only, as a direct message with that person does? Source: flow F41 speaks of "DMs with them", not of groups.
- Which ticket stops a message being sent into a direct message with a deactivated person? Source: flow F41; TOKI-028 says "a rule of the DM and message tickets".
