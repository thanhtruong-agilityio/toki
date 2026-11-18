# Intent: Admin page
Author: Thanh Truong

## Problem
The server can invite people, change roles, deactivate and reactivate them (the member management API), but an Admin has no screen to do it. Without the Admin page nobody but the first Admin can bring a colleague in, and an Admin cannot see who is in the workspace, who is still only invited, whose mail did not go out, or who has been deactivated. The page also has to keep a Member out: a Member who types its address must see nothing of it.
Source: Toki Blueprint, journeys F02, F39, F40 and F41, requirements FR-25 and FR-26, ticket TOKI-025.

## Proposed outcome
- The Admin page opens only for an Admin. A Member sees no Admin entry, and a Member who types the address sees "You do not have access to this page" and nothing else.
- A table of members shows name, email, role, status (Invited, Active, Deactivated; an invitation that ran out shows Expired) and last active. It has a search field, a status chip with a total for each status, the first 50 rows and more on scroll.
- "Invite members" takes several addresses, a role (Member or Admin, Member by default) and shows, for each address, its own result: Invited, Mail not sent with Resend, already a member, already invited. An invited row has Resend and Revoke; Revoke asks for confirmation.
- Each person's row has a menu with Change role, Deactivate and Reactivate; each asks for confirmation that names the person. The entries that the rules forbid are locked, with the reason, on the Admin's own row and on the last Admin.
- The page lists the workspace's channels with their member counts, under the title "Channels", and leaves a place for the "+" that creates a channel.
- Everything works on a phone: no action is hover-only.
Source: Toki Blueprint, ticket TOKI-025, decisions D-061, D-067, D-069, D-070, D-074, D-090, D-099, D-109, D-111, D-131, D-153, D-183.

## Affected users and systems
- Users: Admins, who manage people; Members, who must be kept out; the people who are invited, deactivated or brought back and see the effect on their own sessions.
- Systems: `apps/web` (the `/admin` route, the page and its dialogs), `packages/i18n` (the texts in English and Vietnamese), the member management API it calls, the channel list route.

## Constraints
- Belongs to intent I04 (member-management) of milestone M2. Size: L.
- Needs: TOKI-024 (member management API) and TOKI-093 (confirmation, Undo and form-guard patterns). Also uses the app shell (TOKI-015), the base components and overlays (TOKI-012, TOKI-013, TOKI-014), the API client (TOKI-032), the permission functions (TOKI-027), the texts (TOKI-017) and the date rules (TOKI-094).
- The "+" on the Channels list, the Create channel dialog and everything behind it belong to TOKI-098; the disk-space warning belongs to TOKI-103; the More sheet on a phone belongs to TOKI-092.
- Only an Admin opens the page; the server refuses every admin request from a Member (D-090). There is no Owner role (D-152).
- Invite with the role Member or Admin, up to 50 addresses per batch, each address its own result (D-153, D-134, D-099). The button is disabled while the request runs (D-111).
- Confirmations name their target; a form with content does not close on an outside click (D-069, D-070).
- The member list shows the first 50 and more on scroll (D-109); a count on a chip equals the rows shown (D-074).
- No feature is hover-only or desktop-only (D-067). While offline, admin actions are blocked with an explanation (D-060, D-079).
- Nothing on the page leads to message content, and an Admin does not see private channels or DMs they are not in (F39, D-047).
- English is the default language and every text goes through i18n. Tests are written first.

## Open questions
- What does the row show for a deactivated person who has a pending invitation?
- Does the Admin search ignore diacritics, as Ctrl+K does?
- Which channels does the Channels list show: the ones the Admin may see, or every channel?
- Is "Change role" locked on the Admin's own row, as journey F39 says, or only when the last Admin would be demoted, as the rules say?
- Who refreshes the signed-in person's role, so that the Admin entry appears or disappears at once after a role change?
- Is the "no access" view drawn inside the app frame or alone?
- Does the Expired status have a chip of its own, and does Resend ask for confirmation?
