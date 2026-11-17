# Intent: Member management (API)
Author: Thanh Truong

## Problem
People join Toki only by an invitation from an Admin, and an Admin keeps the member list in order: who may join, in which role, who is still welcome. Today the server has accounts and sign-in but no way to invite anyone, change a role, deactivate or bring back a person, or list the members. Without these server operations the Admin page has nothing to call, nobody but the first Admin can ever enter, and the rules that protect the workspace (the last Admin, nobody deactivating themselves, a Member refused on every admin request) have no single place where they are enforced and recorded.
Source: Toki Blueprint, journeys F02, F39, F40 and F41, requirements FR-25 and FR-26, business rules BR-06 and BR-27 to BR-29, ticket TOKI-024.

## Proposed outcome
- An Admin invites up to 50 addresses at once with the role Member or Admin. Each address gets its own result: invited, mail not sent, already a member, already invited, or not a valid address. Invitations already sent stay when the mail server fails partway.
- An invitation lasts 7 days and works once. An Admin can resend it, which starts a new 7 days and stops the earlier mail from working, or revoke it.
- A deactivated person can be invited again. Accepting the new invitation brings back the same account with the role chosen in the new invitation.
- An Admin changes a role, deactivates a person and reactivates a person. Deactivation ends every session of the person at once. The last Admin cannot be demoted or deactivated, and nobody deactivates themselves, also when two Admins act at the same moment.
- An Admin reads the member list with its statuses and counts. A Member is refused on every one of these requests. A repeat of the same request is ignored, and each administrative action is recorded with who, what, to whom and when.
- The accept-an-invitation work can find an invitation by the link in the mail and accept it through functions this work provides.
Source: Toki Blueprint, ticket TOKI-024, decisions D-094, D-099, D-110, D-111, D-134, D-153, D-181, D-182.

## Affected users and systems
- Users: Admins, who invite and manage people; the invited and the deactivated people, who receive the mail and are let in or out; Members, who are refused on every admin request. The builder, who writes the Admin page and the accept-an-invitation work on top of these operations.
- Systems: the server (`members` module and its tables, the `auth` and mail modules it calls), `packages/shared` (request and response shapes, limits), the permission functions.

## Constraints
- Belongs to intent I04 (member-management) of milestone M2. Size: L.
- Needs: TOKI-022 (sign-in API: sessions, the invitation-code functions) and TOKI-027 (permission functions). Also uses the account tables (TOKI-019), the mail layer (TOKI-021) and the conversation tables (TOKI-028) as they are specified.
- Needed by: TOKI-025 (Admin page) and TOKI-097 (accept an invitation).
- Invite with the role Member or Admin (D-153); no Owner role (D-152); up to 50 addresses per batch (D-134); each address reports its own result and the invitations already sent stay (D-099).
- An invitation lasts 7 days and works once; its mail carries the Join button and a 6-digit code, and the link alone signs nobody in (D-037, D-149). Resend starts a new 7 days and the earlier mail stops working (D-182). Invitations are in English (D-180).
- A deactivated person can be invited again; accepting reactivates the same account with its history and channels, with the role of the new invitation (D-094, D-181).
- Any Admin changes roles and deactivates anyone; the last Admin cannot be demoted or deactivated; nobody deactivates themselves (D-153, BR-27, BR-28). Deactivation ends every session at once and deletes nothing (BR-29).
- The server refuses every admin request from a Member (D-090) and ignores a repeat of the same request (D-111). Every administrative action is recorded on the server (D-110); phase 1 has no screen for the record.
- The Admin list shows the first 50 rows and more on scroll (D-109).
- All routes sit under `/api/v1` and answer in the error format of TOKI-004. Tests are written first.

## Open questions
- When a deactivated person has a pending invitation, which status does the Admin row and the status count show?
- Which ticket builds the Activity item "Lan changed your role to Admin" and the live update of the changed person's screen?
- Does the Admin search ignore diacritics, as Ctrl+K does?
- Is there a limit on invitations across batches, besides the 50 per batch?
- Which ticket supplies the "last active" column of the member table?
- Which ticket owns the table of invitations and the record of administrative actions?
- Does an invitation that has expired count as "already invited" when its address is invited again?
