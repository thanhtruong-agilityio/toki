# Intent: Sign-in API
Author: Thanh Truong

## Problem
Toki has no way to know who is using it. Nothing in Toki may be read without a session, and members have no password: they get in with a 6-digit code sent to their email address.
The account tables (TOKI-019) and the mail layer (TOKI-021) will exist, but nothing yet issues a code, checks it, starts a session or ends one.
Until the server can do that, the sign-in screens (TOKI-023), invitations (TOKI-024, TOKI-097), the session list and emergency link (TOKI-026) and every later feature that needs to know the person have nothing to build on.

## Proposed outcome
A Member or an Admin asks for a code with their email address, receives it by mail, and exchanges it for a session on the device that asked. The session keeps them signed in for 30 days without use and is renewed each time Toki is used. They can sign out, which ends the session for every tab of that browser.
A person who is not a member, or whose account is deactivated, does not get in, and the server never reveals which addresses are members.
The server refuses every other request that comes without a valid session.

## Affected users and systems
- Users: Member and Admin. Source: Toki Blueprint, intent I03 sign-in-by-email-code; capability table, row "Sign in with an emailed code".
- Guests also sign in with an emailed code, in phase 5; they are not part of this ticket. Source: Toki Blueprint, capability table and journey F44.
- Systems: the Toki server (`apps/server`, the `auth` module) and the data contracts in `packages/shared`.
- Uses: the `users`, `login_codes` and `sessions` tables (TOKI-019) and the sign-in mail (TOKI-021).
- Used by: the sign-in screens (TOKI-023), member management (TOKI-024), sessions and emergency access (TOKI-026), and every later server feature that must know who is asking.

## Constraints
- Belongs to Blueprint intent I03 sign-in-by-email-code, alongside TOKI-019, 020, 021, 023, 026 and 099. Source: Toki Blueprint, intent list.
- Milestone: M2, Sign-in, members and conversations. Source: Toki Blueprint, milestone M2.
- Size: L. Source: Toki Blueprint, ticket TOKI-022.
- Needs: TOKI-019 (Account tables) and TOKI-021 (Sending mail over SMTP). Source: Toki Blueprint, ticket dependencies.
- Needed by: TOKI-023, TOKI-024 and TOKI-026. Source: Toki Blueprint, ticket dependencies.
- Agreed scope: request a code, exchange it for a session, sign out; cookie and token. Source: Toki Blueprint, ticket TOKI-022.
- Sign-in is by a 6-digit emailed code; there is no password. Source: D-011, BR-02, FR-01.
- A code is valid for 10 minutes. Source: D-136, FR-01.
- A code works once. Source: BR-02, FR-01.
- A code works only for the request that asked for it: typed on another device, it does not sign that device in. Source: Toki Blueprint, ticket TOKI-022 and journey F04.
- After the 5th wrong try the code is locked and a new one must be requested. A wrong try tells the person how many tries are left. Source: D-137, journey F05.
- At most 5 code requests per email address in 15 minutes. Source: D-038, BR-03, FR-02.
- A code can be sent again only 60 seconds after the last request. Source: D-038, D-082, FR-02.
- A new code cancels the earlier one. Source: D-082, FR-02.
- A code request gets the same answer whether or not the address is a member, and no mail is sent to an address that is not in the workspace. Source: BR-04, journey F05.
- A deactivated account is refused after a correct code. Source: journey F05; account state "Deactivated: cannot sign in".
- A session lasts 30 days on one device and renews on every use, so 30 days means 30 days without opening Toki. Source: D-011, D-138, BR-05, FR-03.
- A session on one device does not sign in another device. Source: FR-03, AC-008.
- Nothing in Toki is readable without a session; sign-in is the only public page. Source: BR-01, FR-03.
- The sign-in card shows the workspace name to a person with no session. Source: journeys F01 and F04, accepted as the baseline by D-091; D-081.
- The sign-in mail carries the 6-digit code only, with no button; nothing in the mail signs anyone in without the code. Source: D-157.
- The sign-in mail is written in the language the member chose. Source: D-180.
- Signing out ends the session on that device; the other tabs of the same browser are signed out at once because they share the session; the person's other devices stay signed in. Source: D-093, D-158, FR-46.
- Two session kinds: a cookie for the web app and a header token for apps. Source: Toki Blueprint, technical design, "Four things the server does now for React Native later".
- The API lives under `/api/v1`; within a version, fields are only added. Source: Toki Blueprint, technical design.
- Codes are stored hashed. Source: Toki Blueprint, technical design, data model.
- There are two roles in phase 1, Member and Admin; there is no Owner. Source: D-152.
- English is the default interface language. Source: D-018.

## Open questions
- An address with an unused invitation (account state "Invited") asks for a code on the normal sign-in page. Is a code sent? The decision log does not say.
- The sign-in mail cannot be sent (the mail server is down). Is the person told? Telling them would reveal that the address is a member (BR-04). The log decides this only for invitations (D-099).
- The limit of 5 requests in 15 minutes is per email address (D-038). Is there also a limit per network address or for the whole server? Without one, anyone who knows a member's address can use up that member's 5 requests, and can keep guessing codes, 5 tries on each new code. The log does not say.
- Do code requests made through "Resend code" on an invitation (TOKI-097) count toward the same 5 requests in 15 minutes as sign-in requests for that address? The log does not say.
- The sign-in page shows the workspace name (journeys F01, F04) before anyone is signed in. Which ticket supplies that name to a page with no session? No ticket scope names it. Answered in the spec: this ticket, by a public read of the name only.
