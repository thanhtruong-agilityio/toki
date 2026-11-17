# Intent: Accept an invitation

Author: Thanh Truong

## Problem

People join Toki only by an invitation from an Admin, and nothing yet lets an invited person use it. The invitation mail has a Join button and a 6-digit code, but no page sits behind the button. A person who presses it needs to land on the code step with the address filled in, get in with the code, and arrive in #general, with no welcome step. The same page has to say what is wrong when the invitation has expired, was revoked or is not recognised, has to send a person whose invitation was already used to the normal sign-in page, and has to ask before it changes anything for a person who is already signed in as someone else. The prototype has no member invitation page; its guest sign-in card is the only design source for the code step.

## Proposed outcome

- Pressing Join opens the code step with the invited address filled in. Opening the link alone signs nobody in.
- The code from the mail is valid for 10 minutes. "Resend code" sends a new one after 60 seconds, and the new code cancels the earlier one. The 5th wrong try locks the code.
- With the right code the person is signed in, is a member of #general and lands there, with no welcome step. Their display name is the part of the address before the @.
- A deactivated person who is invited again gets the same account back, with its history and channels.
- An expired, a revoked and an unrecognised invitation each show a page that says which. An invitation that was already used leads to the normal sign-in page.
- A person who is signed in as someone else is asked before anything changes.

## Affected users and systems

- Users: a person invited as Member or Admin, including a deactivated person who is invited again. Source: Toki Blueprint, journey F03 and decisions D-094 and D-153.
- Systems: the web app (the Join page), `client-core` (three calls and the session state), the server (three public routes behind the page), and the `members`, `auth` and `conversations` server modules. Source: Toki Blueprint, technical design.

## Constraints

- Belongs to Blueprint intent I04 member-management, alongside TOKI-024, 025 and 027. Source: Toki Blueprint, intent list.
- Milestone: M2 Sign-in, members and conversations. Size: M. Source: Toki Blueprint, ticket TOKI-097.
- Needs: the plan lists nothing. The design needs the account tables (TOKI-019), the mail layer (TOKI-021), the Sign-in API (TOKI-022), the sign-in screens (TOKI-023), the invitation record of member management (TOKI-024) and the conversation tables (TOKI-028). Source: the specs of those tickets; plan change.
- Needed by: no ticket lists it. Source: Toki Blueprint, Needs column.
- Join opens the code step with the email filled in; the link alone signs nobody in. Source: decision D-149.
- A code is valid for 10 minutes; "Resend code" is available after 60 seconds and a new code cancels the earlier one; the 5th wrong try locks the code. Source: decisions D-136, D-082, D-137.
- An invitation lasts 7 days and works once; "Resend" on an invitation gives a new 7 days and stops the earlier mail. Source: decisions D-037 and D-182. The invitation itself belongs to member management.
- After the code the newcomer goes straight to #general; there is no welcome step; the display name is the part of the address before the @. Source: decisions D-083, D-034 and D-150.
- A deactivated person who accepts a new invitation gets the same account back, with the role of the new invitation. Source: decisions D-094 and D-181.
- Three refusal pages: expired ("ask the inviter for a new one"), revoked ("ask an admin"), and a link that is not recognised ("This link is not valid", with no workspace name). An invitation already used goes to the normal sign-in page. Source: decision D-081.
- A person signed in as someone else is asked first: "You are signed in as A. Sign out to continue as B?"; choosing no keeps A signed in and leaves the invitation valid. Source: decision D-080.
- Invitations are mailed in English. Source: decision D-180.
- English is the default interface language and every text is translated to Vietnamese through the translation package. Source: decisions D-018 and D-064.
- Smallest size 360 x 560; the layout changes at 720 and 1100 px; nothing hover-only; a modal traps focus. Source: decisions D-054, D-068, D-067 and D-075.
- The API lives under `/api/v1`. Source: Toki Blueprint, technical design.
- Two roles, Member and Admin; there is no Owner. Source: decisions D-152 and D-153.

## Open questions

- Which ticket verifies the token in the Join link, and which builds the Join address?
- What does the Join page show to a deactivated person who is invited again?
- Which wording do the refusal pages and the question for a signed-in person use? The prototype has none.
- Do "Resend code" requests on an invitation count toward the 5 requests in 15 minutes of sign-in codes?
- What does the person read when the mail of a resent code cannot be sent?
- What does the old link show after an Admin has pressed "Resend" on the invitation?
- Which ticket writes the grey line "Minh joined" in #general?
